var map, po, currentData, geoJson;

// Should probably abstract out the couch url and the db prefix and the version and the starting map center.
var config = {
	dbPrefix: '',
	mapCenterLat: 42.3584308,
	mapCenterLon: -71.0597732,
	mapStartZoom: 14,
  db: "api", // relative vhost links defined in rewrites.json
  design: "ddoc",
  vhost: true,
  baseURL: "/",
  host: window.location.href.split( "/" )[ 2 ],  
};

// vhosts are when you mask couchapps behind a pretty URL
function inVhost() {
  var vhost = false;
  if ( document.location.pathname.indexOf( "_design" ) === -1 ) {
    vhost = true;
  }
  return vhost;
}

function showLoader() {
  $('.map_header').first().addClass('loading');  
}

function hideLoader() {
  $('.map_header').first().removeClass('loading');  
}

function gotFirstDoc(data) {
  $.getJSON(config.couchUrl + "/api/" + data.rows[0].id, function(moarData){
    function getCoordinatesArray(obj){
      for(var key in obj) {
        if(key == "coordinates") {
          return obj[key];
        }
        if(typeof(obj) === 'object') {
          getCoordinatesArray(obj[key]);        
        }
      }
      return false;
    }
    function flatten(array){
      var flat = [];
      for (var i = 0, l = array.length; i < l; i++){
        var type = Object.prototype.toString.call(array[i]).split(' ').pop().split(']').shift().toLowerCase();
        if (type) { 
          flat = flat.concat(/^(array|collection|arguments|object)$/.test(type) ? flatten(array[i]) : array[i]); 
        }
      }
      return flat;
    }
    function getCoordinates(coordinates) {
      return flatten(coordinates);
    }
    var coordinates = getCoordinatesArray(moarData.geometry);
    var center = getCoordinates(coordinates);
    console.log(center)
    config.mapCenterLon = center[0];
    config.mapCenterLat = center[1];
    createMap(config);
  })
}

function createMap(config) {
  po = org.polymaps;
  geoJson = po.geoJson();
  config.mapContainer = $('div.map_container');
  
  var featuresCache = {};
  map = po.map()
      .container(config.mapContainer[0].appendChild(po.svg("svg")))
      .zoom(config.mapStartZoom)
      .center({lat: config.mapCenterLat, lon: config.mapCenterLon})
      .add(po.interact())
      .add(po.hash());

  map.add(po.image()
      .url(po.url("http://{S}tile.cloudmade.com"
      + "/d3394c6c242a4f26bb7dd4f7e132e5ff" // http://cloudmade.com/register
      + "/998/256/{Z}/{X}/{Y}.png")
      .repeat(false)
      .hosts(["a.", "b.", "c.", ""])));

  map.add(po.compass()
      .pan("none"));
  
  function randomColor(colors) {
    var sick_neon_colors = ["#CB3301", "#FF0066", "#FF6666", "#FEFF99", "#FFFF67", "#CCFF66", "#99FE00", "#EC8EED", "#FF99CB", "#FE349A", "#CC99FE", "#6599FF", "#03CDFF"];
    return sick_neon_colors[Math.floor(Math.random()*sick_neon_colors.length)];
  };
  
  function load(e){
    var cssObj = randColor = randomColor();
    for (var i = 0; i < e.features.length; i++) {
      var feature = e.features[i];
      if( feature.data.geometry.type == 'LineString' || feature.data.geometry.type == 'MultiLineString' ) {
        cssObj = {
          fill: 'none',
          stroke: randColor,
          strokeWidth:2,
          opacity: .9 
        }
      } else {
        cssObj = {
          fill: randColor,
          opacity: .9 
        }
      }
      $( feature.element )
        .css( cssObj )
    }
    
    var counts = {};
    $.each(e.features, function( i, feature) {
      var type = this.data.geometry.type.toLowerCase(),
          el = this.element,
          $el   = $(el),
          $cir  = $(el.firstChild),
          text  = po.svg('text'),
          props = $.extend(this.data.properties, {content: 'sadasd'}),
          check = $('span.check[data-code=' + props.code + ']'),
          inact = check.hasClass('inactive');
      if(!counts[props.code]) {
        counts[props.code] = 0
      } 
      counts[props.code]++
      $el.bind('click', {props: props, geo: this.data.geometry}, onPointClick)      
      text.setAttribute("text-anchor", "middle")
      text.setAttribute("dy", ".35em")
      text.appendChild(document.createTextNode(props.code))
      el.appendChild(text)
    })
  }

  function fetchFeatures(bbox, callback) {
    $.ajax({
      url: config.couchUrl + "/data",
      dataType: 'jsonp',
      data: {
        "bbox": bbox
      },
      success: callback
    });
  }

  var showDataset = function() {
    var bbox = getBB();
    showLoader();
    fetchFeatures( bbox, function( data ){
      console.log(JSON.stringify(data));
      var feature = po.geoJson()
            .features( data.features )
            .on( "show", load );
      map.add( feature );
      hideLoader();
    })
  }

  var getBB = function(){
    return map.extent()[0].lon + "," + map.extent()[0].lat + "," + map.extent()[1].lon + "," + map.extent()[1].lat;
  }

  var onPointClick = function( event ) {
    
   var coor = event.data.geo.coordinates,
       props = event.data.props;
  
   config.mapContainer
     .maptip(this)
     .map(map)
     .data(props)
     .location({lat: coor[1], lon: coor[0]})
     .classNames(function(d) {
       return d.code
     })
     .top(function(tip) {
       var point = tip.props.map.locationPoint(this.props.location)
       return parseFloat(point.y - 30)
     })
     .left(function(tip) {
       var radius = tip.target.getAttribute('r'),
           point = tip.props.map.locationPoint(this.props.location)
       
       return parseFloat(point.x + (radius / 2.0) + 20)
     })
     .content(function(d) {
       var self = this,
           props = d,
           cnt = $('<div/>'),
           hdr = $('<h2/>'),
           bdy = $('<p/>'),
           check = $('#sbar span[data-code=' + props.code + ']'),
           ctype = check.next().clone(),
           otype = check.closest('li.group').attr('data-code'),
           close = $('<span/>').addClass('close').text('x')


       hdr.append($('<span/>').addClass('badge').text('E').attr('data-code', otype))
         .append(ctype)
         .append(close)
         .addClass(otype) 
       
       bdy.text(props.address)
       bdy.append($('<span />')
         .addClass('date')
         .text(props.properties.neighborhood))
       
       cnt.append($('<div/>').addClass('nub'))
       cnt.append(hdr).append(bdy) 
       
       close.click(function() {
         self.hide()
       })   
   
       return cnt
     }).render()    
  };
  showDataset();
}

$(function(){  
  if ( !inVhost() ) {
    var cfg = config;
    cfg.vhost = false
    cfg.db = document.location.href.split( '/' )[ 3 ];
    cfg.design = unescape( document.location.href ).split( '/' )[ 5 ];
    cfg.couchUrl = "/" + cfg.db + "/_design/" + cfg.design + "/_rewrite/";
  }

  $.ajax({ 
    url: config.couchUrl + "/api/_all_docs?limit=1",
    dataType: 'jsonp', 
    success: gotFirstDoc
  }); 

  $(".gencalls").click(function(){
    $('#dialog ul').html("");
    $('[type=checkbox]').each(function(i, item){
      var input = $(this),
          dataSet = config.dbPrefix + input.parent().attr('class');

      if( $(this).attr('checked') ) {
        $('#dialog ul').append( "<li><a href='"+config.couchUrl + config.rewrite + "/"+config.version+"/" + dataSet + "?" + $.param({"bbox": getBB()}) + "'>" + dataSet + "</a></li>" );
      }
    });
    
    $('#dialog').dialog({
      modal: true,
      title: 'API Calls',
      width: 400
    })
  })
});