export function wechatTextUnits(value: string) {
  return Array.from(value).reduce((total, character) => {
    return total + (/^[\x00-\x7F]$/.test(character) ? 0.5 : 1);
  }, 0);
}

export function isWechatTitleLengthValid(value: string) {
  return wechatTextUnits(value.trim()) <= 32;
}
