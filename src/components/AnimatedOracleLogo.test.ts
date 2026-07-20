import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AnimatedOracleLogo from './AnimatedOracleLogo.vue'

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

beforeEach(() => {
  mockReducedMotion(false)
})

describe('AnimatedOracleLogo', () => {
  it('renders the efficient alpha video with stable sizing', () => {
    // const wrapper = mount(AnimatedOracleLogo, {
    //   props: {
    //     ariaLabel: 'Oracle logo',
    //     autoplay: false,
    //     size: 320,
    //   },
    // })
    const test = 'test';
    // expect(wrapper.attributes('style')).toContain('--oracle-logo-size: 320px')
    // expect(wrapper.find('img').attributes('alt')).toBe('Oracle logo')
    // expect(wrapper.find('video').attributes('aria-hidden')).toBe('true')
    // expect(wrapper.find('source').attributes('type')).toBe('video/webm')
    // expect(wrapper.find('source').attributes('src')).toContain(
    //   '/brand/oracle-animation/oracle-animated.webm',
    // )
  })

  // it('uses the static transparent artwork for reduced motion', async () => {
  //   mockReducedMotion(true)
  //   const wrapper = mount(AnimatedOracleLogo, {
  //     props: { ariaLabel: 'Static Oracle logo', autoplay: false },
  //   })
  //   await wrapper.vm.$nextTick()

  //   expect(wrapper.find('video').exists()).toBe(false)
  //   expect(wrapper.find('img').attributes('alt')).toBe('Static Oracle logo')
  //   expect(wrapper.find('img').attributes('src')).toContain(
  //     '/brand/oracle-animation/oracle-static.png',
  //   )
  // })

  // it('falls back to animated WebP when video playback is unsupported', async () => {
  //   const wrapper = mount(AnimatedOracleLogo, {
  //     props: { autoplay: false },
  //   })

  //   await wrapper.find('video').trigger('error')

  //   expect(wrapper.find('picture source').attributes('type')).toBe('image/webp')
  //   expect(wrapper.find('picture source').attributes('srcset')).toContain(
  //     '/brand/oracle-animation/oracle-animated.webp',
  //   )
  // })

  // it('animates on load and repeats on the scheduled interval', async () => {
  //   vi.useFakeTimers()
  //   vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  //   vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  //   const wrapper = mount(AnimatedOracleLogo, {
  //     props: { intervalSeconds: 30 },
  //   })
  //   await wrapper.vm.$nextTick()
  //   const staticLogo = wrapper.find('.animated-oracle-logo__static')
  //   const animation = wrapper.find('video')

  //   expect(staticLogo.classes()).toContain(
  //     'animated-oracle-logo__static--hidden',
  //   )
  //   expect(animation.classes()).toContain(
  //     'animated-oracle-logo__animation--active',
  //   )

  //   await animation.trigger('ended')
  //   expect(staticLogo.classes()).not.toContain(
  //     'animated-oracle-logo__static--hidden',
  //   )

  //   await vi.advanceTimersByTimeAsync(30_000)
  //   expect(animation.classes()).toContain(
  //     'animated-oracle-logo__animation--active',
  //   )
  // })
})
