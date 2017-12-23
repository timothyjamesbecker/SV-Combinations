/* 
 * fusorSV web app sorted view
 */
var metadata =        {}; //load the metadata
var caller_colors =   {};
var metric_map =      {'f1': 'f1', 'j': 'j', 'rec':'m:n', 'pre':'n:m'};
var caller_masks    = ['T','N','M']; //trim off callers here
var color_brewer = [[166,206,227],[31,120,180],[178,223,138],[51,160,44],[251,154,153],
                    [227,26,28],[253,191,111],[255,127,0],[202,178,214],[106,61,154],[255,255,153]];

load_metadata();      //get metadata first
search_framework();   //now build search framework
call_set_framework(); //build colorspace and attach color marking functionality

//AJAX loading of the metadata payload used to autopopulate the visualization
function load_metadata(){
    require(["dojo/json","dojo/dom", "dojo/on", "dojo/request", "dojo/domReady!"],
        function(JSON, dom, on, request){
            // Request the text file
            request.get('_metrics/metadata.json').then(
                function(response){
                	metadata = JSON.parse(response);
                	//add some reverse mappings
                	var types = {};
                	var bins = {};
                	for(target in metadata){
                		for(type in metadata[target]['t']){
                			types[metadata[target]['t'][type]] = Number(type);
                		}
                		for(bin in metadata[target]['b']){
                			bins[metadata[target]['b'][bin]] = Number(bin);
                		}
                		metadata[target]['t_i'] = types;
                		metadata[target]['b_i'] = bins;
                	}
                },
                function(error){    console.log(error); }
            );
        });
} 

//filter unwanted caller keys from the displayed results
function filter_callers(metadata){
    var callers = {};
    for(target in metadata){
        var filtered = {};
        var cs = metadata[target]['g'];
        for(g in cs){
            var allow = true;
            for(c in caller_masks){
                if(cs[g]==null || cs[g].charAt(0)==caller_masks[c]){ allow = false; }
            }
            if(allow){
                filtered[g] = cs[g];
                callers[g]  = cs[g];
            }
        }
        metadata[target]['g'] = filtered;
    }
    return callers;
}

//given the callers from the meta data generate an even rgb color space starting at red
//exclude white for the background, black for metric indicators and grey for default color space
function generate_caller_colors(callers,scale,offset,alpha,random){
    //random 24-bit color divided by the number of colors c with white, black and grey reserved...
    var i = 0;
    var color = 0;
    var caller_colors = {};
    var k = Object.keys(callers);
    for(i = 0; i < k.length; i++){
        if(!random && i < color_brewer.length){
            caller_colors[callers[k[i]]] = color_brewer[i];
            caller_colors[callers[k[i]]].push(alpha);
        }
        else{
            caller_colors[callers[k[i]]] = [Math.floor(Math.random()*scale)+offset,
                                            Math.floor(Math.random()*scale)+offset,
                                            Math.floor(Math.random()*scale)+offset,alpha];
        }
    }
    return caller_colors;
}

function call_set_framework(){
    require(["d3/d3","dojo/dom-geometry","dojo/dom-style","dojo/dom","dojo/dom-construct","dojo/dom-class","dojo/json",
             "dijit/form/ToggleButton","dojo/_base/Color","dojo/domReady!"],
    function(d3,domGeom,Style,dom,con,Class,JSON,ToggleButton,Color){
        var scale =  100;
        var offset = 100;
        var alpha = 0.25;
        var random = false;
        caller_colors = generate_caller_colors(filter_callers(metadata),scale,offset,alpha,random);
        var k = Object.keys(caller_colors)
        k.sort();
        for(c in k){ //sorted keys here for div display
            var color = new Color(caller_colors[k[c]]);
            //console.log(color);
            con.create("button",{Id:"call_set_"+String(k[c])},"call_set_div"); 
            new ToggleButton({
                baseClass:"caller_button",//programatic button coloring
                showLabel: true,
                checked: false,
                onChange: function(val){
                    //console.log(this.id);
                    if(val){ //selection is on
                        //change the button color
                        var on_color = new Color(Style.get(this.id,"backgroundColor"));
                        var array = on_color.toRgba();
                        array[3] = 1.0;
                        on_color = new Color(array);
                        //console.log(on_color);
                        Style.set(this.id,"backgroundColor",on_color);
                        var rect = this.id.substring(9,this.id.length);
                        //console.log("rect_"+rect);
                        //mark each rectangle that has this key k[c]
                        d3.selectAll(".rect_"+rect).style({"fill": on_color.toString()});
                    }
                    else{ //selection is off
                        var off_color = new Color(Style.get(this.id,"backgroundColor"));
                        var array = off_color.toRgba();
                        array[3] = alpha;
                        off_color = new Color(array);
                        //console.log(off_color);
                        Style.set(this.id,"backgroundColor",off_color);
                        var rect = this.id.substring(9,this.id.length);
                        //console.log("rect_"+rect);
                        //mark each rectangle that has this key k[c]
                        d3.selectAll(".rect_"+rect).style({"fill": "grey"});
                    }
                },
                label: String(k[c])
            }, "call_set_"+String(k[c])).startup();
            Style.set("call_set_"+String(k[c]),{backgroundColor:color});
            Class.add("call_set_"+String(k[c]), "call_set");   
        }
    });
}

/*given the metadata: {target:{'b':{'0':'1-10','1','10-50',...},
                               't':{'0':'SUB','1':'INS','2':'DEL'...},
                               'm':{'n:m':'pre','m:n':'rec'...},
                               'g':{'0':'T','18':'L',...}
                               'r':{'b':null,'f1':0.54,'j':0.21,'prec':0.7,'rec':0.2}}}*/
function search_framework(){
    require(["d3/d3","dojo/dom-geometry","dojo/dom-style","dojo/dom","dojo/dom-construct","dojo/dom-class","dojo/json",
             "dojo/query","dijit/form/Button","dijit/form/Select","dojo/NodeList-dom","dojo/domReady!"],
    function(d3,domGeom,Style,dom,con,Class,JSON,Query,Button,Select){
        var target = Object.keys(metadata)[0]; //target metadata
        var d_style = {
            padding:"10px",
            width:"60px",
            color:"#05396B",
            backgroundColor:"rbg(255,255,255)",
            borderRadius:"4px",
            opacity:"1.0"    
        }; //baseline style to pass into dymanic dom items
        
        //target drop down menu---------------------------
        opts = [];
        for(k in metadata){ opts.push({label:k,value:k}); }
        new Select({id:'target_select',name:"target",options: opts}).placeAt("search_div").startup();
        Style.set(dom.byId("target_select"),d_style);
        
        //type
        opts = [];
        for(k in metadata[target]['t']){ opts.push({label:metadata[target]['t'][k],value:metadata[target]['t'][k]}); }
        new Select({id:'type_select',name:"type",options: opts}).placeAt("search_div").startup();
        Style.set(dom.byId("type_select"),d_style);
        
        //metric
        opts = [];
        for(k in metadata[target]['m']){
            metric_map[metadata[target]['m'][k]] = k;
            opts.push({label:metadata[target]['m'][k],value:metadata[target]['m'][k]});
        }
        new Select({id:'metric_select',name:"metric",options: opts}).placeAt("search_div").startup();
        Style.set(dom.byId("metric_select"),d_style);
        
        new Select({
            id:'top_select',
            name:"top",
            options: [{label:"Get 10",value:10},
                      {label:"Get 50",value:50},
                      {label:"Get 100",value:100}]
        }).placeAt("search_div").startup();
        Style.set(dom.byId("top_select"),d_style);
        
		//get results and show an axis
        var view   = con.create("button",{Id:"view"},"search_div");
        var view_btn = new Button({
            baseClass:"base_button",
            showLabel:true,
            label: "bins", // analogous to title when showLabel is false
            onClick: function(){
                Query(".call_set").forEach(function(node){ 
                    var toggle = dijit.getEnclosingWidget(node);
                    if(toggle){ toggle.attr("checked",false); }
                });
                dom.byId("bins_div").innerHTML = "";               //reset the bins div
                dom.byId("axis_div").innerHTML = "";               //reset the axis
                axis_plot(target,metadata[target]['t_i'][dijit.byId("type_select").value],60,20,2);
                graph_t_m_bins(dijit.byId("target_select").value,
                               dijit.byId("type_select").value,
                               dijit.byId("metric_select").value,
                               metadata[target]['b'],
                               dijit.byId("top_select").value);
            }
        }, "view").startup();
    });
}

//for each bin in the search query, AJAX get and plot with D3
function graph_t_m_bins(target,type,metric,bins,top){
    require(["dojo/dom","dojo/dom-construct","dojo/dom-class","dojo/domReady!"],
    function(dom,con,cl) {
            for(b in bins){
                var uri = "_metrics/"+target+"/sorted/"+type+"/"+bins[b]+"/"+metric+".json"; //find the file
                var bin_id = "bin"+b+"_span";                                          //give it an id
                var bin  = con.create("span",{Id:bin_id},"bins_div");                  //make a span for it
                bar_plot_json(uri,bin_id,bins[b],metric,top,60,20,2);                                  
            }
    });    
}

function axis_plot(target,type,barWidth,barHeight,barMargin){
	require(["d3/d3","dojo/dom","dojo/domReady!"],
	function(d3,dom){
		bins = metadata[target]['b'];
		ns   = metadata[target]['n'][type];

        var max = -1;       
       	var data = [];
       	for(i in ns){
       		if(ns[i]>max){ max = ns[i]; }
       		data.push({'b':bins[i],'v':ns[i]});
       	}
       	if(max > 0.0){ //normalize for easy histogram display
	       	for(i in data){ data[i]['n'] = data[i]['v']/max; }
	    }
       	
       	var inner = 0.5;
       	var outer = 0.75;
       	
   		var svg = d3.select("#axis_div")
        	.append("svg")
        	.attr("width", (barWidth+4*barMargin)*data.length)
        	.attr("height", 2*barHeight)
        	.style({"padding":barMargin+"px","margin":barMargin+"px","color":"white"});
        
        var bin = svg.selectAll("g")
        	.data(data)
        	.enter()
        	.append("g")
        	.attr("transform", function(d, i) { return "translate("+i*(barWidth+4*barMargin) + ",0)"; });
        	
        //outer bar container
        bin.append("rect")
        	.attr("width",barWidth)
        	.attr("height",barHeight)
        	.attr("rx",2*barMargin)
        	.attr("ry",2*barMargin)
        	.attr("class", function(d) { return "axis_"+d['b']; })
        	.style({"fill":"black","stroke":"none"});
             
        //inner n value for histogram
        bin.append("rect")
        	.attr("y",barHeight/2)
        	.attr("x",0) //centered barWidth/2-barWidth*d['n']/2
        	.attr("width",function(d){ return d['n']*barWidth; }) //on the bar
        	.attr("height",barHeight/2)
        	.attr("rx",2*barMargin)
        	.attr("ry",2*barMargin)
        	.attr("class", function(d) { return "axis_"+d['b']; })
        	.style({"fill":"grey","stroke":"none","pointer-events":"none"});
        	
        //white text for bin range label	
        bin.append("text") 
			.attr("x", barMargin)
			.attr("y", barHeight/4)
			.attr("dy",".35em")
			.style({"font-size":"50%","fill":"white","text-anchor":"center","pointer-events":"none"})
			.text(function(d) { return d['b']+" bp"; });
		
		bin.append("text") 
			.attr("x", barMargin)
			.attr("y", barHeight+4*barMargin)
			.attr("dy",".35em")
			.style({"font-size":"60%","fill":"black","text-anchor":"center","pointer-events":"none"})
			.text(function(d) { return d['v']; });
		
	});
}

//AMD template for d3
//require(["d3.min/d3","dojo/dom","dojo/domReady!"], function(d3){});
function bar_plot_json(uri,bin_id,bin_value,metric,top,barWidth,barHeight,barMargin){
    require(["d3/d3","dojo/dom","dojo/domReady!"], 
    function(d3,dom){
        d3.json(uri, function(error, json){
            if(error) return console.log(error);
            raw = json;          //load one of the files
            metric = metric_map[metric];
            var data = [];
            for(i=0; i<d3.min([top,d3.max([0,raw.length])]); i++){
                console.log('uri='+uri+', bin='+bin_value+', metric='+metric+', length='+raw.length);
            	if(raw[i]['g'].length >0 && raw[i]['g'][0]!=null){
            	    if(raw[i]['g'][0]=='F'){ console.log(raw[i]['r']); }
                	data.push(raw[i]); //TO DO::: Filter U(L,D,H)=0.5 if there exists a I(L)=0.5
                }
            }
            var n = data.length;
    		
        	var print = d3.format("01.5f");
        	var x = d3.scale.linear()
            	.domain([0.0,1.0]) 
            	.range([0, barWidth]);       
            //do the dojo dom-geometry thing here to use on the top and left values
            
            var tooltip = d3.select("#info_div")
                .append("tooltip_div")
                .style({"visibility":"hidden","position":"fixed","top":"110px","left":"10px","font-size":"120%"});
   		
            //start drawing bars
            var svg = d3.select("#"+bin_id)	
            	.append("svg")
            	.classed(bin_id+"chart",true);
        	
        	var chart = d3.select("."+bin_id+"chart")
            	.attr("width", barWidth)
            	.attr("height", barHeight*top)
            	.style({"padding":barMargin+"px","margin":barMargin+"px","color":"white"});
			
        	var bar = chart.selectAll("g")
            	.data(data)
          	    .enter().append("g")
            	.attr("transform", function(d, i) { return "translate(0," + i*barHeight + ")";});
            
            //outer bar container
            bar.append("rect")
            	.attr("width",barWidth)
            	.attr("height",barHeight)
            	.attr("rx",2*barMargin)
        		.attr("ry",2*barMargin)
            	.attr("class", function(d) {
                    var group = "";
                    for(i = 0; i < d['g'].length; i++){
                        group += "rect_"+d['g'][i]+" ";
                    }
                    group = group.substring(0,group.length-1);
                    return group;
                })
            	.style({"fill":"grey","opacity":0.1,"z-index":100,"stroke":"black","stroke-width":1})
                .on("mouseover", function(d){
                	d3.select("#info_div").style("opacity",1.0);
                	//console.log(d)
                	var rank = d['r'][metric];
                	var group = d['g'];
                	if(group[0].charAt(0)=='N'){ group = [group[0]]; }
                	var s = '<span style="padding:8px">Value: '+print(d[metric])+"<span/>"+
                		    '<span style="padding:8px">Rank: '+rank+"<span/>"+
                	        '<span style="padding:8px">Group: '+group+"<span/>"+
                	        '<span style="padding:8px">Feature: '+d['f']+"<span/>"+
                	        '<span style="padding:8px">Calls: '+d['m']+"<span/>";//+
                	        '<span style="padding:8px">LBP: '+Math.trunc(d['b'][0])+" bp<span/>"+
                	        '<span style="padding:8px">RBP: '+Math.trunc(d['b'][3])+ " bp</span>";
            	    return tooltip
            	    	.style({"visibility":"visible"})
            	    	.html(s);
            	 })
                .on("mouseout", function(d){
                	d3.select("#info_div").style("opacity",0.0);
                	//d3.select(this).style("opacity",0.4);
                    return tooltip.style("visibility", "hidden");
                 });
                 
            //actual metric bar here
            bar.append("rect")
                .attr("width", function(d) { return x(d[metric]); })
                .attr("height", barHeight-2*barMargin)
                .attr("rx",2*barMargin)
        		.attr("ry",2*barMargin)
                .attr("class", function(d) {
                    var group = "";
                    for(i = 0; i < d['g'].length; i++){
                        group += "rect_"+d['g'][i]+" ";
                    }
                    group = group.substring(0,group.length-1);
                    return group;
                })
                .style({"fill": "grey","pointer-events":"none"});
        
            var inner = 0.2;
            bar.append("line")
                .attr("x1", barWidth/2-1)
                .attr("x2", barWidth/2-1)
                .attr("y1", 0)
                .attr("y2", barHeight)
                .attr("stroke-width", 1)
                .attr("stroke", "grey")
                .style({"opacity":inner,"pointer-events":"none"});
                
            bar.append("line")
                .attr("x1", barWidth/4-1)
                .attr("x2", barWidth/4-1)
                .attr("y1", 0)
                .attr("y2", barHeight)
                .attr("stroke-width", 1)
                .attr("stroke", "grey")
                .style({"opacity":inner,"pointer-events":"none"});
                
            bar.append("line")
                .attr("x1", 3*barWidth/4-1)
                .attr("x2", 3*barWidth/4-1)
                .attr("y1", 0)
                .attr("y2", barHeight)
                .attr("stroke-width", 1)
                .attr("stroke", "grey")
                .style({"opacity":inner,"pointer-events":"none"});
            //pad lower regions where n < top    
            padding = [];
            for(var i = 0; i < top-n+1;i++){ padding.push(0); }
            var pad = chart.selectAll("g")
            	.data(padding)
          	    .enter().append("g")
            	.attr("transform", function(d, i) { return "translate(0," + i*barHeight + ")";});
            var inner = 0.2;
            pad.append("line")
                .attr("x1", barWidth/2-1)
                .attr("x2", barWidth/2-1)
                .attr("y1", 0)
                .attr("y2", barHeight)
                .attr("stroke-width", 1)
                .attr("stroke", "grey")
                .style({"opacity":inner,"pointer-events":"none"});
            pad.append("line")
                .attr("x1", barWidth/4-1)
                .attr("x2", function(d,i){
                	var x_l = barWidth/4-1;
                	if((n+i+1)%10==0){ x_l = barWidth/2-1; }
                	return x_l;
                 })
                .attr("y1", barHeight/2-1)
                .attr("y2", barHeight/2-1)
                .attr("stroke-width", 1)
                .attr("stroke", "grey")
                .style({"opacity":inner,"pointer-events":"none"});
            pad.append("text")
			.attr("x", barWidth/4)
			.attr("y", barHeight/4)
			.attr("dy",".35em")
			.style({"font-size":"40%","fill":"black","pointer-events":"none"})
			.text(function(d, i) {
				var s = "";
				if((n+i+1)%10==0){ s = String(n+i+1); }
				return s;
			}); //replace with a function to read out the bin size and the n value
            
        });
    });  
}

