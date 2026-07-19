<template>
  <div
    class="animated-oracle-logo"
    :style="{ '--oracle-logo-size': normalizedSize }"
  >
    <img
      :alt="ariaLabel"
      class="animated-oracle-logo__media animated-oracle-logo__static"
      :class="{ 'animated-oracle-logo__static--hidden': animationActive }"
      :src="staticUrl"
    />
    <picture
      v-if="!reducedMotion && videoFailed && intervalSeconds <= 0"
      class="animated-oracle-logo__animation"
    >
      <source :srcset="animatedWebpUrl" type="image/webp">
      <img
        alt=""
        class="animated-oracle-logo__media"
        :src="staticUrl"
      />
    </picture>
    <video
      v-else-if="!reducedMotion && !videoFailed"
      ref="video"
      aria-hidden="true"
      :autoplay="autoplay && intervalSeconds <= 0"
      class="
        animated-oracle-logo__media
        animated-oracle-logo__animation
      "
      :class="{
        'animated-oracle-logo__animation--active': animationActive,
      }"
      :loop="loop && intervalSeconds <= 0"
      muted
      playsinline
      :poster="posterUrl"
      preload="metadata"
      @ended="finishScheduledAnimation"
      @error="videoFailed = true"
    >
      <source :src="animatedWebmUrl" type="video/webm">
    </video>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  size?: number | string
  autoplay?: boolean
  loop?: boolean
  paused?: boolean
  ariaLabel?: string
  intervalSeconds?: number
}>(), {
  size: '100%',
  autoplay: true,
  loop: true,
  paused: false,
  ariaLabel: 'Animated DoomsdayMTG Oracle logo',
  intervalSeconds: 0,
})

const assetRoot = `${import.meta.env.BASE_URL}brand/oracle-animation`
const animatedWebmUrl = `${assetRoot}/oracle-animated.webm`
const animatedWebpUrl = `${assetRoot}/oracle-animated.webp`
const posterUrl = `${assetRoot}/oracle-poster.png`
const staticUrl = `${assetRoot}/oracle-static.png`
const video = ref<HTMLVideoElement | null>(null)
const videoFailed = ref(false)
const reducedMotion = ref(false)
const visible = ref(true)
const animationActive = ref(false)
let observer: IntersectionObserver | null = null
let motionQuery: MediaQueryList | null = null
let animationTimer: ReturnType<typeof setInterval> | null = null

const normalizedSize = computed(() =>
  typeof props.size === 'number' ? `${props.size}px` : props.size,
)

function syncPlayback() {
  if (!video.value) return
  if (
    props.paused
    || !props.autoplay
    || !visible.value
    || (props.intervalSeconds > 0 && !animationActive.value)
  ) {
    video.value.pause()
    return
  }
  const playback = video.value.play()
  void playback?.catch(() => {
    // Browsers may still block autoplay despite muted playback. The poster
    // remains visible and a later intersection change retries playback.
  })
}

function beginScheduledAnimation() {
  if (
    props.intervalSeconds <= 0
    || props.paused
    || reducedMotion.value
    || !visible.value
    || !video.value
  ) return
  video.value.currentTime = 0
  animationActive.value = true
  syncPlayback()
}

function finishScheduledAnimation() {
  if (props.intervalSeconds <= 0) return
  animationActive.value = false
  if (video.value) video.value.currentTime = 0
}

function configureAnimationTimer(playImmediately = false) {
  if (animationTimer) clearInterval(animationTimer)
  animationTimer = null
  animationActive.value = props.intervalSeconds <= 0 && !reducedMotion.value
  if (props.intervalSeconds > 0 && props.autoplay) {
    animationTimer = setInterval(
      beginScheduledAnimation,
      props.intervalSeconds * 1000,
    )
    if (playImmediately) beginScheduledAnimation()
  }
}

function updateMotionPreference(event?: MediaQueryListEvent) {
  reducedMotion.value = event?.matches ?? motionQuery?.matches ?? false
  if (motionQuery) configureAnimationTimer()
}

watch(
  () => [props.autoplay, props.paused, visible.value],
  () => syncPlayback(),
)
watch(
  () => props.intervalSeconds,
  () => configureAnimationTimer(),
)

onMounted(() => {
  if (typeof window.matchMedia !== 'function') {
    configureAnimationTimer(true)
    syncPlayback()
    return
  }
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference()
  motionQuery.addEventListener('change', updateMotionPreference)

  if ('IntersectionObserver' in window && video.value) {
    observer = new IntersectionObserver(([entry]) => {
      visible.value = entry?.isIntersecting ?? true
      syncPlayback()
    })
    observer.observe(video.value)
  }
  configureAnimationTimer(true)
  syncPlayback()
})

onBeforeUnmount(() => {
  if (animationTimer) clearInterval(animationTimer)
  observer?.disconnect()
  motionQuery?.removeEventListener('change', updateMotionPreference)
})
</script>

<style scoped>
.animated-oracle-logo {
  align-items: center;
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  max-width: 100%;
  overflow: visible;
  position: relative;
  width: var(--oracle-logo-size);
}

.animated-oracle-logo__media {
  inset: 0;
  display: block;
  height: 100%;
  object-fit: contain;
  position: absolute;
  width: 100%;
}

.animated-oracle-logo__static {
  opacity: 1;
  transition: opacity 140ms ease;
}

.animated-oracle-logo__static--hidden {
  opacity: 0;
}

.animated-oracle-logo__animation {
  opacity: 0;
  transform: scale(0.783);
  transition: opacity 140ms ease;
}

.animated-oracle-logo__animation--active,
.animated-oracle-logo > picture {
  opacity: 1;
}
</style>
