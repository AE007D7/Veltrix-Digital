(() => {
'use strict';
const labels={apple_pay:'Apple Pay',google_pay:'Google Pay',link:'Link',amazon_pay:'Amazon Pay',cashapp:'Cash App Pay',klarna:'Klarna',affirm:'Affirm',afterpay_clearpay:'Afterpay / Clearpay',paypal:'PayPal',alipay:'Alipay',wechat_pay:'WeChat Pay',ideal:'iDEAL',bancontact:'Bancontact',eps:'EPS',p24:'Przelewy24',sepa_debit:'SEPA Direct Debit',us_bank_account:'US bank account',acss_debit:'Pre-authorized debit',bacs_debit:'Bacs Direct Debit',au_becs_debit:'BECS Direct Debit',boleto:'Boleto',oxxo:'OXXO',pix:'Pix',promptpay:'PromptPay',paynow:'PayNow',grabpay:'GrabPay',twint:'TWINT',revolut_pay:'Revolut Pay',swish:'Swish',mobilepay:'MobilePay',vipps:'Vipps',mb_way:'MB WAY',multibanco:'Multibanco',zip:'Zip',samsung_pay:'Samsung Pay',kakao_pay:'Kakao Pay',naver_pay:'Naver Pay',kr_card:'Korean cards',payco:'PAYCO',satispay:'Satispay',billie:'Billie',alma:'Alma',crypto:'Stablecoins',pay_by_bank:'Pay by bank',customer_balance:'Bank transfer',fpx:'FPX'};
const translations={
en:{title:'Secure payments with Stripe',text:'Choose your payment method on the secure checkout page.',note:'Available methods depend on your country, currency, device and order. Stripe shows the eligible options at checkout.'},
fr:{title:'Paiements sécurisés avec Stripe',text:'Choisissez votre moyen de paiement sur la page sécurisée.',note:'Les moyens disponibles dépendent du pays, de la devise, de l’appareil et de la commande. Stripe affiche les options éligibles au paiement.'},
ar:{title:'دفع آمن عبر Stripe',text:'اختر وسيلة الدفع على صفحة الدفع الآمنة.',note:'تعتمد وسائل الدفع المتاحة على البلد والعملة والجهاز والطلب. يعرض Stripe الخيارات المؤهلة عند الدفع.'},
es:{title:'Pagos seguros con Stripe',text:'Elige tu método de pago en la página segura.',note:'Los métodos disponibles dependen del país, la moneda, el dispositivo y el pedido. Stripe muestra las opciones válidas al pagar.'}};
let methods=[];
function badge(id,label){
 const el=document.createElement('span');el.className='payment-badge payment-badge--'+id;el.setAttribute('role','img');el.setAttribute('aria-label',label);el.title=label;
 if(id==='mastercard'){el.innerHTML='<svg viewBox="0 0 64 36" aria-hidden="true"><circle cx="25" cy="18" r="14" fill="#eb001b"/><circle cx="39" cy="18" r="14" fill="#f79e1b"/><path d="M32 5.9a14 14 0 0 1 0 24.2 14 14 0 0 1 0-24.2" fill="#ff5f00"/></svg>';}
 else el.textContent=label;
 return el;
}
function render(){
 const c=translations[(document.documentElement.lang||'en').slice(0,2)]||translations.en;
 document.querySelectorAll('[data-payment-methods]').forEach(host=>{
  host.replaceChildren();const list=document.createElement('div');list.className='payment-methods';list.setAttribute('aria-label','Payment methods');
  if(methods.includes('card'))for(const [id,label] of [['visa','VISA'],['mastercard','Mastercard'],['amex','AMERICAN EXPRESS'],['discover','DISCOVER'],['diners','Diners Club'],['jcb','JCB'],['unionpay','UnionPay']])list.append(badge(id,label));
  const order=['apple_pay','google_pay','link',...methods.filter(m=>!['card','apple_pay','google_pay','link'].includes(m))];
  for(const id of [...new Set(order)])if(methods.includes(id))list.append(badge(id,labels[id]||id.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')));
  if(methods.length){host.append(list);const note=document.createElement('p');note.className='payment-methods-note';note.textContent=c.note;host.append(note);}
  host.hidden=!methods.length;
 });
 const title=document.getElementById('veltrixPayTitle'),text=document.getElementById('veltrixPayText');if(methods.length){if(title)title.textContent=c.title;if(text)text.textContent=c.text;}
}
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
fetch('/api/checkout',{headers:{Accept:'application/json'}}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{methods=data.checkoutEnabled===true&&Array.isArray(data.paymentMethods)?data.paymentMethods.filter(m=>typeof m==='string'&&/^[a-z][a-z0-9_]{1,50}$/.test(m)):[];render()}).catch(()=>{methods=[];render()});
})();