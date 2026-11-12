// Listing data shared by the homepage and the full-screen map:
// example listings, formatting helpers and loading live listings.
(function(){
  var EXAMPLES=[
    {n:"Taco Food Truck",loc:"Denver, CO",lat:39.74,lng:-104.99,ask:140,rev:142,cf:51,cat:"Food & drink",g:["#ffb36b","#ff6b8b"],ph:"photo-1519861155730-0b5fbf0dd889",v:true,
     d:"Fully equipped truck with a loyal lunch crowd and two recurring brewery spots. Owner works 4 days a week; recipes, permits and social accounts transfer with the sale."},
    {n:"Boutique Yoga Studio",loc:"Austin, TX",lat:30.27,lng:-97.74,ask:175,rev:188,cf:62,cat:"Fitness",g:["#8ec5ff","#b49cff"],ph:"photo-1761971975962-9cc397e2ba2a",v:true,
     d:"Bright 1,800 sq ft studio with about 220 active members and six contract instructors. Lease has four years remaining."},
    {n:"Residential Lawn Care Route",loc:"Charlotte, NC",lat:35.23,lng:-80.84,ask:125,rev:121,cf:47,cat:"Routes",g:["#9be7a8","#3fb8a3"],ph:"photo-1458245201577-fc8a130b8829",v:false,
     d:"Around 140 recurring residential accounts in tight neighborhoods. Sale includes truck, trailer, two commercial mowers and scheduling software."},
    {n:"Neighborhood Coffee Bar",loc:"Portland, OR",lat:45.52,lng:-122.68,ask:235,rev:310,cf:78,cat:"Food & drink",g:["#d9a77a","#8a5a3b"],ph:"photo-1567880905822-56f8e06fe630",v:true,
     d:"Corner cafe with strong morning traffic and a wholesale pastry partner. Trained staff of five stays on through the transition."},
    {n:"24/7 Strength Gym",loc:"Phoenix, AZ",lat:33.45,lng:-112.07,ask:340,rev:420,cf:112,cat:"Fitness",g:["#7f8cff","#3a3f9e"],ph:"photo-1623874106686-5be2b325c8f1",v:false,
     d:"Key-fob access gym with squat racks, platforms and a turf lane. Membership billing is automated; light owner involvement."},
    {n:"Coin Laundromat",loc:"Columbus, OH",lat:39.96,lng:-83.0,ask:240,rev:205,cf:69,cat:"Services",g:["#a0e9ff","#5aa9e6"],ph:"photo-1757233285714-4de702bb8a56",v:true,
     d:"Thirty washers and dryers, recently upgraded to card readers. Wash-and-fold pickup adds a growing second revenue stream."},
    {n:"Mobile Dog Grooming Van",loc:"Tampa, FL",lat:27.95,lng:-82.46,ask:95,rev:98,cf:39,cat:"Services",g:["#ffd56b","#ff9f6b"],ph:"photo-1597603413826-cd1c06b05222",v:false,
     d:"Self-contained grooming van with a booked-out schedule and repeat clients every 4 to 6 weeks. Booking app and client list included."},
    {n:"Snack Vending Route",loc:"Seattle, WA",lat:47.61,lng:-122.33,ask:75,rev:76,cf:29,cat:"Routes",g:["#c3f0ca","#6fcf97"],ph:"photo-1681632973141-6aaa0a2dd9f2",v:true,
     d:"Eighteen machines in offices and gyms, serviced one day a week. Machines are owned outright with cashless readers installed."}
  ];
  EXAMPLES.forEach(function(x,i){x.example=true;x.id='ex-'+i});
  var MIN_SHOWN=6; // pad with examples until there are this many real listings
  var PALETTE=[["#ffb36b","#ff6b8b"],["#8ec5ff","#b49cff"],["#a0e9ff","#5aa9e6"],["#f9a8d4","#c084fc"],["#9be7a8","#3fb8a3"],["#ffd56b","#ff9f6b"],["#7f8cff","#3a3f9e"],["#d9a77a","#8a5a3b"]];
  function gradFor(c){ if(GRAD[c])return GRAD[c]; var h=0; for(var i=0;i<c.length;i++)h=(h*31+c.charCodeAt(i))>>>0; return PALETTE[h%PALETTE.length]; }
  var GRAD={"Food & drink":["#ffb36b","#ff6b8b"],"Fitness":["#8ec5ff","#b49cff"],"Services":["#a0e9ff","#5aa9e6"],"Retail":["#f9a8d4","#c084fc"],"Routes":["#9be7a8","#3fb8a3"],"Other":["#cbd5e1","#94a3b8"]};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(k){k=Math.round(k*10)/10;return k>=1000?('$'+(k/1000).toFixed(1).replace('.0','')+'M'):('$'+(k>=100?Math.round(k):k)+'K')}
  function safeImg(u){return /^\/api\/photos\/[a-f0-9]{16}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(u||'')?u:''}
  function photo(x,w,h){
    var grad='linear-gradient(135deg,'+x.g[0]+','+x.g[1]+')';
    if(x.img) return 'url('+x.img+'), '+grad;
    if(x.ph) return 'url(https://images.unsplash.com/'+x.ph+'?auto=format&fit=crop&w='+w+'&h='+h+'&q=70), '+grad;
    return grad;
  }
  function fromApi(l){
    var photos=(l.photos||[]).map(safeImg).filter(Boolean);
    return {id:l.id,n:l.name,loc:l.city+', '+l.state,lat:l.lat,lng:l.lng,ask:l.ask/1000,rev:l.revenue/1000,cf:l.cashFlow/1000,
      cat:(l.category==='Other'&&l.categoryOther)?l.categoryOther:l.category,catKey:l.category,g:gradFor(l.category),img:photos[0]||'',photos:photos,v:!!l.verified,d:l.description,
      tier:l.tier,broker:l.broker||null,video:/^https:\/\/\S+$/i.test(l.video||'')?l.video:'',year:l.yearEstablished,emp:l.employees,reason:l.reason};
  }
  // Live listings plus examples (until there are MIN_SHOWN live ones).
  function load(){
    return fetch('/api/listings').then(function(r){return r.ok?r.json():{listings:[]}})
      .then(function(d){return (d.listings||[]).map(fromApi)}).catch(function(){return []})
      .then(function(real){return {real:real,all:real.concat(real.length<MIN_SHOWN?EXAMPLES:[])}});
  }
  // A listing's own page.
  function pageUrl(x){ return '/listing/'+encodeURIComponent(x.id); }
  // The small card shown when a map pin is clicked.
  function popupHtml(x){
    return '<div class="popimg" style="background-image:'+photo(x,520,240)+'"><span>'+esc(x.example?'Example':x.cat)+'</span></div>'+
      '<div class="popbody"><b>'+esc(x.n)+(x.v?'<span class="popver">✓ Verified</span>':'')+'</b>'+
      '<div class="pl">'+esc(x.loc)+(x.example?'':' · '+esc(x.cat))+'</div>'+
      '<div class="popnums"><div>Asking<em>'+money(x.ask)+'</em></div><div>Revenue<em>'+money(x.rev)+'</em></div><div>Cash flow<em>'+money(x.cf)+'</em></div></div>'+
      '<a class="popgo" href="'+pageUrl(x)+'">View details</a></div>';
  }
  window.NOL={pageUrl:pageUrl,popupHtml:popupHtml,EXAMPLES:EXAMPLES,MIN_SHOWN:MIN_SHOWN,gradFor:gradFor,esc:esc,money:money,safeImg:safeImg,photo:photo,fromApi:fromApi,load:load};
})();
