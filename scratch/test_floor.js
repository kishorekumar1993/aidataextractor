let a = '5/F., Office Park, Number 535, Qingshuiqiao Road, Hi-Tech Zone, Ningbo';
const regex = /(^|[,\s])(\d{1,3})\s*(?:\/|\s*)?F\.?(?=[,\s]|$)/gi;
console.log('Match?', regex.test(a));
regex.lastIndex = 0;
a = a.replace(regex, (m, p1, num) => {
  const n = parseInt(num, 10);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  const ord = s[(v - 20) % 10] || s[v] || s[0];
  return `${p1}${n}${ord} Floor`;
});
console.log('Result:', a);
