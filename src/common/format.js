export const money = value => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
}).format(Number(value) || 0);

export const initials = name => (name || 'Lead')
  .split(' ')
  .map(part => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

export const today = () => new Date().toISOString().slice(0, 10);