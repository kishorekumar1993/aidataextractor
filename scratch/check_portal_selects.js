fetch('https://kishorekumar1993.github.io/dataextraction/')
  .then(r => r.text())
  .then(html => {
    const allSelects = [...html.matchAll(/<select[^>]*id=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/select>/gi)];
    allSelects.forEach(s => {
      console.log('ID:', s[1]);
      const opts = [...s[2].matchAll(/<option[^>]*value=["']?([^"'>]*)["']?[^>]*>([\s\S]*?)<\/option>/gi)].map(o => ({ val: o[1], txt: o[2].trim() }));
      console.log(opts);
    });
  })
  .catch(e => console.error(e));

