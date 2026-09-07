// 兼容 MoviePilot API 包装器与原始响应的两种返回形态。
export function unwrapResponse(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data') && response.success !== undefined) {
    return response.data
  }
  return response?.data ?? response
}

// 标准化：统一把「插件返回对象」展开成其 data 字段（若无则原样返回）。
export function dataOf(object) {
  if (!object || typeof object !== 'object') return object ?? {}
  if (object.success !== undefined && Object.prototype.hasOwnProperty.call(object, 'data')) {
    return object.data ?? {}
  }
  return object
}

// 字节 -> 可读大小
export function formatSize(value) {
  const num = Number(value || 0)
  if (!Number.isFinite(num) || num < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  let v = num
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 2)} ${units[i]}`
}

// 千位分隔（数量）
export function fmtInt(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toLocaleString() : '0'
}

// 取状态别名中文（后端归一化后状态即中文或原文）。
export function fmtRatio(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toFixed(2) : '0.00'
}
