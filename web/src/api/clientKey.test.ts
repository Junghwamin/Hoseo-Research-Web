import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CLIENT_KEY_STORAGE_KEY,
  clearClientKey,
  getClientKey,
  maskKey,
  setClientKey,
  useClientKey,
  validateKeyFormat,
} from './clientKey'

/** 가짜 키는 실행 시점에 조립한다. 소스에 통짜로 적으면 비밀 스캐너가 문다. */
const FAKE_KEY = ['sk', 'test', 'x'.repeat(24)].join('-')

beforeEach(() => {
  localStorage.clear()
  clearClientKey()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('브라우저 키 저장소', () => {
  it('처음에는 없다', () => {
    expect(getClientKey()).toBeNull()
  })

  it('저장하면 다듬어서 들고 있고 저장소에도 남는다', () => {
    setClientKey(`  ${FAKE_KEY}  `)
    expect(getClientKey()).toBe(FAKE_KEY)
    expect(localStorage.getItem(CLIENT_KEY_STORAGE_KEY)).toBe(FAKE_KEY)
  })

  it('지우면 메모리와 저장소에서 함께 사라진다', () => {
    setClientKey(FAKE_KEY)
    clearClientKey()
    expect(getClientKey()).toBeNull()
    expect(localStorage.getItem(CLIENT_KEY_STORAGE_KEY)).toBeNull()
  })

  it('저장소가 예외를 던져도 메모리에서 동작한다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => setClientKey(FAKE_KEY)).not.toThrow()
    expect(getClientKey()).toBe(FAKE_KEY)
  })

  it('useClientKey 는 저장·삭제 즉시 다시 그린다', () => {
    const { result } = renderHook(() => useClientKey())
    expect(result.current).toBeNull()
    act(() => setClientKey(FAKE_KEY))
    expect(result.current).toBe(FAKE_KEY)
    act(() => clearClientKey())
    expect(result.current).toBeNull()
  })
})

describe('마스킹과 형식 검사', () => {
  it('앞 5자와 뒤 4자만 남긴다', () => {
    // 통짜 리터럴을 쓰면 저장소 위생 검사(test_repo_hygiene)가 키로 본다.
    expect(maskKey(FAKE_KEY)).toBe('sk-te…xxxx')
    expect(maskKey('sk-short')).toBe('sk-…')
  })

  it.each([
    ['abc', 'sk- 로 시작해야 합니다'],
    ['sk-short', '키가 너무 짧습니다'],
    [`sk-${'x'.repeat(10)} ${'y'.repeat(10)}`, '공백이나 한글이 섞여 있습니다'],
    [`sk-한글${'x'.repeat(20)}`, '공백이나 한글이 섞여 있습니다'],
    [`sk-${'x'.repeat(300)}`, '키가 너무 깁니다'],
  ])('%s → %s', (key, message) => {
    expect(validateKeyFormat(key)).toBe(message)
  })

  it('형식이 맞으면 null', () => {
    expect(validateKeyFormat(FAKE_KEY)).toBeNull()
    expect(validateKeyFormat(`  ${FAKE_KEY}\n`)).toBeNull()
  })
})
