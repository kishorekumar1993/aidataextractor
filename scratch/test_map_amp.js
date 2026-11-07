const url = '//maps.google.com.tw/maps?f=q&amp;source=s_q&amp;hl=en-TW&amp;geocode=&amp;q=%E5%98%89%E7%BE%A9%E5%B8%82%E5%BE%8C%E6%B9%96%E9%87%8C%E4%BF%9D%E9%A0%86%E8%B7%AF228%E8%99%9F&amp;hnear=600%E5%98%89%E7%BE%A9%E5%B8%82%E6%9D%B1%E5%8D%80%E4%BF%9D%E9%A0%86%E8%B7%AF228%E8%99%9F';
const decoded = decodeURIComponent(url);
console.log('Direct test:', decoded.match(/[?&](?:q|query|place|destination|daddr|saddr|hnear)=([^&"'>]+)/i));
const decodedEntities = decodeURIComponent(url.replace(/&amp;/g, '&'));
console.log('With &amp; decoded:', decodedEntities.match(/[?&](?:q|query|place|destination|daddr|saddr|hnear)=([^&"'>]+)/i));

