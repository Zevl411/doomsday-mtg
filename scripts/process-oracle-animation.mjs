import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PNG } from 'pngjs'

const require = createRequire(import.meta.url)
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path
const root = process.cwd()
const sourceVideo = join(root, 'public/brand/animated-hero.mp4')
const sourceStill = join(root, 'public/brand/oracle-full.png')
const outputDirectory = join(root, 'public/brand/oracle-animation')
const workDirectory = join(tmpdir(), 'doomsday-oracle-animation')
const framesDirectory = join(workDirectory, 'frames')
const matteDirectory = join(workDirectory, 'matte')

if (process.env.ORACLE_FRAMES_READY !== '1') {
  rmSync(workDirectory, { force: true, recursive: true })
}
mkdirSync(framesDirectory, { recursive: true })
mkdirSync(matteDirectory, { recursive: true })
mkdirSync(outputDirectory, { recursive: true })

if (process.env.ORACLE_FRAMES_READY !== '1') {
  // This crop excludes the generator watermark and retains the moving logo.
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', sourceVideo,
    '-vf', 'crop=500:390:70:125',
    join(framesDirectory, 'frame-%04d.png'),
  ])
}

for (let frame = 1; frame <= 240; frame += 1) {
  const name = `frame-${String(frame).padStart(4, '0')}.png`
  const sourcePath = join(framesDirectory, name)

  try {
    writeFileSync(
      join(matteDirectory, name),
      removeEdgeConnectedBackground(readFileSync(sourcePath)),
    )
  } catch (error) {
    if (error?.code === 'ENOENT') break
    throw error
  }
}

stabilizeOpeningMatte(matteDirectory)

writeFileSync(
  join(outputDirectory, 'oracle-static.png'),
  removeEdgeConnectedBackground(readFileSync(sourceStill)),
)
writeFileSync(
  join(outputDirectory, 'oracle-poster.png'),
  readFileSync(join(matteDirectory, 'frame-0001.png')),
)

if (process.env.ORACLE_SKIP_ENCODING !== '1') {
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', '24',
    '-i', join(matteDirectory, 'frame-%04d.png'),
    '-loop', '0',
    '-lossless', '1',
    '-pix_fmt', 'yuva420p',
    join(outputDirectory, 'oracle-animated.webp'),
  ])

  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', '24',
    '-i', join(matteDirectory, 'frame-%04d.png'),
    '-plays', '0',
    '-f', 'apng',
    join(outputDirectory, 'oracle-animated.png'),
  ])
}

function removeEdgeConnectedBackground(buffer) {
  const image = PNG.sync.read(buffer)
  const { data, height, width } = image
  const backgroundPalette = sampleFrameEdge(data, width, height)
  const removed = new Uint8Array(width * height)
  const queued = new Uint8Array(width * height)
  const queue = []

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]
    const x = index % width
    const y = Math.floor(index / width)
    if (!isBackgroundPixel(data, index, backgroundPalette)) continue
    removed[index] = 1
    if (x > 0) enqueue(x - 1, y)
    if (x + 1 < width) enqueue(x + 1, y)
    if (y > 0) enqueue(x, y - 1)
    if (y + 1 < height) enqueue(x, y + 1)
  }

  for (let index = 0; index < removed.length; index += 1) {
    if (removed[index]) data[index * 4 + 3] = 0
  }

  return PNG.sync.write(image)

  function enqueue(x, y) {
    const index = y * width + x
    if (queued[index]) return
    queued[index] = 1
    queue.push(index)
  }
}

function stabilizeOpeningMatte(directory) {
  const reference = PNG.sync.read(
    readFileSync(join(directory, 'frame-0006.png')),
  )

  // The source opens with a black circle expanding over white. Before that
  // black region reaches every frame edge, it can appear disconnected from
  // the exterior. Reusing the first settled silhouette for these five frames
  // removes the transition without allowing the matte into dark wheel wedges.
  for (let frame = 1; frame <= 5; frame += 1) {
    const name = `frame-${String(frame).padStart(4, '0')}.png`
    const path = join(directory, name)
    const image = PNG.sync.read(readFileSync(path))
    for (let offset = 3; offset < image.data.length; offset += 4) {
      image.data[offset] = reference.data[offset]
    }
    writeFileSync(path, PNG.sync.write(image))
  }
}

function sampleFrameEdge(data, width, height) {
  const colors = []
  const seen = new Set()

  for (let x = 0; x < width; x += 4) {
    add(x)
    add((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 4) {
    add(y * width)
    add(y * width + width - 1)
  }
  return colors

  function add(index) {
    const offset = index * 4
    const color = [
      data[offset],
      data[offset + 1],
      data[offset + 2],
    ]
    // Quantizing keeps the palette bounded while retaining both the white and
    // black regions present during the expanding-background transition.
    const key = color.map(value => Math.round(value / 8) * 8).join(',')
    if (seen.has(key)) return
    seen.add(key)
    colors.push(color)
  }
}

function isBackgroundPixel(data, index, backgroundPalette) {
  const offset = index * 4
  const red = data[offset]
  const green = data[offset + 1]
  const blue = data[offset + 2]
  return backgroundPalette.some(
    background => Math.sqrt(
      (red - background[0]) ** 2
      + (green - background[1]) ** 2
      + (blue - background[2]) ** 2,
    ) <= 30,
  )
}
