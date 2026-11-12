// NextOwner satellite map (Leaflet + Esri World Imagery), shared by the
// homepage map and the full-screen /map page.
(function(){
  var US=[[24.5,-125],[49.5,-66.5]];

  function create(el, opts){
    opts=opts||{};
    var mobile=L.Browser.mobile;
    var map=L.map(el,{
      zoomControl:false, attributionControl:true, worldCopyJump:true, minZoom:3, maxZoom:19, zoomSnap:0.25,
      scrollWheelZoom:!!opts.wheel, dragging:!(mobile&&opts.dragOnMobile===false), touchZoom:!(mobile&&opts.dragOnMobile===false)
    });
    L.control.zoom({position:opts.zoomPosition||'bottomright'}).addTo(map);
    map.attributionControl.setPrefix(false);
    var base='https://server.arcgisonline.com/ArcGIS/rest/services/';
    L.tileLayer(base+'World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:18,
      attribution:'Imagery © Esri, Maxar, Earthstar Geographics'}).addTo(map);
    // Roads and place names on top of the imagery, so it reads like a hybrid map.
    L.tileLayer(base+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:18,opacity:.7}).addTo(map);
    L.tileLayer(base+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:18}).addTo(map);
    map.fitBounds(US,{paddingTopLeft:[10,30],paddingBottomRight:[10,4]});
    // On an embedded map, the mouse wheel zooms only after someone clicks into the map,
    // so scrolling the page past it doesn't get stuck.
    if(opts.wheelOnFocus){
      map.on('click focus',function(){map.scrollWheelZoom.enable()});
      map.on('mouseout blur',function(){map.scrollWheelZoom.disable()});
    }
    return map;
  }

  function priceIcon(text){
    return L.divIcon({className:'nopin-wrap',html:'<span class="nopin">'+text+'</span>',iconSize:null,iconAnchor:[0,0]});
  }

  // items: [{lat,lng,label,title}]; handlers: {click(i), hover(i,on), popup(i) -> html}
  function markers(map, items, handlers){
    handlers=handlers||{};
    return items.map(function(x,i){
      if(x.lat==null||x.lng==null) return null;
      var m=L.marker([x.lat,x.lng],{icon:priceIcon(x.label),title:x.title||'',riseOnHover:true,keyboard:true});
      if(handlers.popup) m.bindPopup(function(){return handlers.popup(i)},{className:'nopop',maxWidth:280,minWidth:240,offset:[0,-30],autoPanPadding:[24,90]});
      if(handlers.click) m.on('click',function(){handlers.click(i)});
      if(handlers.hover){ m.on('mouseover',function(){handlers.hover(i,true)}); m.on('mouseout',function(){handlers.hover(i,false)}); }
      m.addTo(map);
      return m;
    });
  }

  function show(map, m, on){ if(!m) return; if(on){ if(!map.hasLayer(m)) m.addTo(map); } else if(map.hasLayer(m)) map.removeLayer(m); }

  function highlight(m, on){ var el=m&&m.getElement(); if(el){ el.classList.toggle('hl',on); m.setZIndexOffset(on?1000:0); } }

  // Fits the map to the shown markers, or to the US when there are none.
  function fit(map, ms, opts){
    var pts=ms.filter(function(m){return m&&map.hasLayer(m)}).map(function(m){return m.getLatLng()});
    if(!pts.length){ map.fitBounds(US,Object.assign({paddingTopLeft:[10,30],paddingBottomRight:[10,4]},opts||{})); return; }
    if(pts.length===1){ map.setView(pts[0],10,opts); return; }
    map.fitBounds(L.latLngBounds(pts),Object.assign({maxZoom:11,paddingTopLeft:[36,44],paddingBottomRight:[36,14]},opts||{}));
  }

  // State outlines: hovering lightly highlights a state, clicking zooms to it.
  // opts.count(abbr) -> number of listings shown in that state (for the label).
  var statesData=null;
  function states(map, opts){
    opts=opts||{};
    var hoverable=window.matchMedia&&matchMedia('(hover: hover)').matches;
    var base={stroke:true,color:'#ffffff',weight:0.8,opacity:0.35,fill:true,fillColor:'#ffffff',fillOpacity:0};
    var hot={weight:2,opacity:0.9,fillOpacity:0.16};
    function label(f){
      var n=opts.count?opts.count(f.properties.abbr):null;
      return '<b>'+f.properties.name+'</b>'+(n==null?'':'<br>'+(n?n+(n===1?' business':' businesses')+' for sale':'No listings yet'));
    }
    (statesData||(statesData=fetch('/us-states.json').then(function(r){return r.json()}))).then(function(geo){
      var layer=L.geoJSON(geo,{style:function(){return base},onEachFeature:function(f,l){
        if(hoverable) l.bindTooltip(function(){return label(f)},{sticky:true,direction:'top',offset:[0,-12],className:'nostate'});
        l.on('mouseover',function(){ l.setStyle(hot); });
        l.on('mouseout',function(){ l.setStyle(base); });
        l.on('click',function(){
          map.fitBounds(l.getBounds(),{paddingTopLeft:[24,48],paddingBottomRight:[24,16],maxZoom:8,animate:true});
          if(opts.onState) opts.onState(f.properties.abbr,f.properties.name);
        });
      }}).addTo(map);
      layer.bringToBack();
    }).catch(function(){});
  }

  window.NOMap={create:create,markers:markers,show:show,highlight:highlight,fit:fit,states:states,US:US};
})();
