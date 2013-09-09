var dragStartPos = null;
var draggingSymbolStartPos = null;
var startSize = null;

var selectedSymbol = null;

var inputBox = null;

var symbols = ["+", "-", "="];
var fracAspectRatio = 100;

var nextSymbolId = 0;

var groupBox = null;
var resizing = false;

$(function ()
{
   // Document ready
    
    $("body").on("click", "button.parse", function(e)
    {
        parse();
    });
	
    $("#canvas").on("mousedown", ".symbol .handle", function(e)
    {
		console.log("mousedown .handle");
		resizing = true;
	});
	
    $("#canvas").on("mousedown", ".symbol", function(e)
    {
		console.log("mousedown .symbol");
		if (!$(e.target).closest(".symbol").hasClass("selected"))
		{
			select([$(e.target).closest(".symbol")]);
		}
        dragStartPos = {x: e.pageX, y: e.pageY};
        draggingSymbolStartPos = $(selectedSymbols).map(function() {return $(this).position()});
        startSize = $(selectedSymbols).map(function() {return {width: $(this).width(), height: parseFloat($(this).css("font-size"))};});
		console.log("dssp" ,draggingSymbolStartPos);
    });
    
	$("#canvas").on("mousedown", function(e)
	{
        if ($(e.target).filter("#canvas").length > 0)
        {
			groupBox = $("<div/>").addClass("groupBox")
			                      .css("top", e.pageY)
								  .css("left", e.pageX)
								  .data("pinX", e.pageX)
								  .data("pinY", e.pageY)
								  .width(0)
								  .height(0).mouseup(groupBoxMouseUp)
								  .mousemove(function(ev)
								  {
									setGroupBoxCorner(ev.pageX, ev.pageY);
								  }).appendTo($("body"))
		}
	});

	
    $("#canvas").on("mouseup", function(e)
    {
		resizing = false;
		if (groupBox)
		{
			groupBoxMouseUp(e);
		}
		else if (dragStartPos)
		{
			dragStartPos = null;
			draggingSymbolStartPos = null;
		}
        else if ($(e.target).filter("#canvas").length > 0 || $(e.target).filter(".groupBox").length > 0)
        {
            select(null);
			createInputBox(e.pageX - $("#canvas").position().left, e.pageY - $("#canvas").position().top);
            e.preventDefault();
            return false;
        }
		
        parse();
    });
      
    $("#canvas").on("click", function(e)
	{
		if (groupBox)
			groupBox.remove();
		groupBox = null;
	});
	
    $("#canvas").on("mousemove", function(e)
    {
        if (dragStartPos)
        {
			var dx = e.pageX - dragStartPos.x;
			var dy = e.pageY - dragStartPos.y;
			
			if (resizing)
			{
				for (var i = 0; i < selectedSymbols.length; i++)
				{
					if(selectedSymbols[i].data("token") == ":frac")
					{
						if (startSize[i].width + dx > 10)
						{
							selectedSymbols[i].width(startSize[i].width + dx);
							selectedSymbols[i].height((startSize[i].width + dx) / fracAspectRatio);
						}
					}
					else 
					{
						if (startSize[i].height + dy > 5)
						{
							selectedSymbols[i].css("font-size", startSize[i].height + dy);
							var bounds = measureText(selectedSymbols[i].data("token"), selectedSymbols[i].css("font"), startSize[i].height + dy, (startSize[i].height + dy) * 2);
							selectedSymbols[i].width(bounds.width);
							selectedSymbols[i].height(bounds.height);
							selectedSymbols[i].find("div.content").css("top", -bounds.top)
														  .css("left", -bounds.left)
														  
						}
					}
				}
			}
			else
			{
				for (var i = 0; i < selectedSymbols.length; i++)
				{
					selectedSymbols[i].css("left", draggingSymbolStartPos[i].left + dx);
					selectedSymbols[i].css("top", draggingSymbolStartPos[i].top + dy);
				}
			}
        }
		else if (groupBox)
		{
			setGroupBoxCorner(e.pageX, e.pageY);
		}
    });
    
    $("body").on("keydown", function(e)
    {
        console.log(e);
        if(e.which == 46)
        {
			for(var i = 0; i < selectedSymbols.length; i++)
				selectedSymbols[i].remove();
            parse();
        }
    });

});

function createInputBox(x,y)
{
	var newBox = $('<input type="text"/>').css("position", "absolute")
							 .css("left", x - parseFloat($("#canvas").css("font-size")) / 2)
							 .css("top", y - parseFloat($("#canvas").css("font-size")) / 2)
							 .css("width", $("#canvas").css("font-size"))
							 .css("text-align", "left")
							 .css("padding-left", parseFloat($("#canvas").css("font-size")) / 2)
							 .css("font", $("#canvas").css("font"))
							 .css("background", "rgba(255,255,255,0.6)")
							 .appendTo($("#canvas"))
							 .blur(function(e) { commitNew(newBox); })
							 .keyup(function(e)
							 {
								console.log(e);
								if (e.which == 13) // enter
									commitNew(newBox);
								else if (e.which == 27) // escape
									newBox.remove();
								else if (e.which == 32) // space
								{
									var newSym = commitNew(newBox);
									createInputBox(x + newSym.width() + parseFloat($("#canvas").css("font-size")) / 4, y);
								}
								else
									autoSize(newBox);
							 });
	newBox.focus();
}

function setGroupBoxCorner(x, y)
{
	var gx = parseFloat(groupBox.css("left"));
	var gy = parseFloat(groupBox.css("top"));
	if (x < groupBox.data("pinX"))
	{
		groupBox.width(groupBox.data("pinX") - x);
		groupBox.css("left",x);
	}
	else
	{
		groupBox.width(x - gx);
	}
	
	if (y < groupBox.data("pinY"))
	{
		console.log(groupBox.data("pinY")-y);
		groupBox.height(groupBox.data("pinY") - y);
		groupBox.css("top",y);
	}
	else
	{
		groupBox.height(y-gy);
	}
}

function groupBoxMouseUp(ev)
{
	if (groupBox.width() == 0 && groupBox.height() == 0)
	{
		groupBox.remove();
		groupBox = null;
		$("#canvas").trigger(ev);
		return;
	}
	
	var gTop = parseFloat(groupBox.css("top"));
	var gLeft = parseFloat(groupBox.css("left"));
	var gRight = gLeft + groupBox.width();
	var gBottom = gTop + groupBox.height();
	var selectedSymbols = [];
	
	$(".symbol").filter(function()
	{
		var sTop = parseFloat($(this).css("top")) + parseFloat($("#canvas").css("top"));
		var sLeft = parseFloat($(this).css("left")) + parseFloat($("#canvas").css("left"));
		var sRight = sLeft + $(this).width();
		var sBottom = sTop + $(this).height();
		return sBottom > gTop && sTop < gBottom && sRight > gLeft && sLeft < gRight;
		
	}).each(function()
	{
		selectedSymbols.push($(this));
	});
	
	select(selectedSymbols);
	
	
	groupBox.remove();
	groupBox = null;
}

function autoSize(box)
{
	console.log(box.width(), box.val());
	var d = $("<div/>").html(box.val())
	                   .css("font", box.css("font"))
					   .css("display", "inline-block");
	$("body").append(d);
	console.log("D", d.width());
	box.width(d.width() + 30);
	console.log(box.width());
	d.remove();
	
}

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function commitNew(box)
{/*
    var val = box[0].value.trim();
    
    if (!isNumber(val) && val.length != 1)
    {
        console.error("Invalid input");
        box.remove();
        return;
    }*/
    var str = box[0].value.trim();
    if (!str)
    {
        console.error("No input provided");
        box.remove();
        return;
    }
    
    var acc = str[0];
    var vals = [];
    for(var i = 1; i < str.length; i++)
    {
        if (isNumber(acc) && (isNumber(str[i]) || str[i] == "."))
        {
            acc += str[i];
        }
        else
        {
            vals.push(acc);
            acc = str[i];
        }
    }
    if (acc)
        vals.push(acc);
    
    var xAcc = 0;
    for (var i = 0; i < vals.length; i++)
    {
        console.log("Adding val", vals[i]);
        var newSym = commitNewVal(xAcc + parseFloat(box.css("left")) + 20, parseFloat(box.css("top")) + box.height() / 2, vals[i]);
        xAcc += newSym.width();
    }
    
    parse();
    box.remove();
	return newSym;
}

function commitNewVal(x, y, val)
{
    switch(val)
    {
        case "/":
            var newSym = genFrac(x, y, 40);
            newSym.data("token", ":frac");
            newSym.data("type", "type/symbol");
            break;
        default:
            var newSym = genSym(val, x, y);
            newSym.data("token", val);
            newSym.data("type", "type/symbol");
            break;
    }
    newSym.append($("<div/>").addClass("handle"));
    $("#canvas").append(newSym);
    return newSym;
}

function genFrac(x, y, width)
{
    var newSym = $('<div/>').addClass("symbol").addClass("frac");
    newSym.css("left",x);
    newSym.css("top", y);
    newSym.css("width", width);
    
    newSym.css("height", Math.max(1, width / fracAspectRatio));
	newSym.attr("data-eq-id", "eqsym" + nextSymbolId++);
	newSym.append($("<div/>").height(16)
						     .css("left",0)
							 .css("top",-8 + newSym.height() / 2)
	                         .addClass("fracBackground"));
    newSym.data("token", ":frac");
	
    /*newSym.on("mousewheel", function(e)
    {
        var oldWidth = newSym.width();
        if (e.originalEvent.wheelDelta > 0)
            newSym.width(newSym.width() * 1.1);
        else
            newSym.width(newSym.width() / 1.1);
        
        newSym.height(newSym.width() / fracAspectRatio);
        newSym.css("left", parseFloat(newSym.css("left")) - (newSym.width() - oldWidth)/2);
        parse();
        e.preventDefault();
        return false;
    });*/
    
    return newSym;
}

function genSym(v,x,y)
{
    if (!endsWith($("#canvas").css("font-size"), "px"))
    {
        console.error("Canvas font size must be specified in px.");
        return;
    }
    
    var fontSize = parseFloat($("#canvas").css("font-size"));
    var bounds = measureText(v, $("#canvas").css("font"), fontSize, fontSize * 2);
    
    var newSym = $('<div/>').addClass("symbol")
                            .width(bounds.width)
                            .height(bounds.height)
                            .append($("<div/>").addClass("contentOuter")
							                   .append ($("<div/>").addClass("content")
							                                       .css("position", "absolute")
                                                                   .css("left", -bounds.left)
																   .css("top", -bounds.top)
																   .html(v)));
    
    newSym.css("left",x);
    newSym.css("top", y - bounds.height/2);
	newSym.attr("data-eq-id", "eqsym" + nextSymbolId++);
	newSym.data("token", v);
	nextSymbolId++;
	/*
    newSym.on("mousewheel", function(e)
    {
        var oldWidth = newSym.width();
        var oldHeight = newSym.height();
        if (e.originalEvent.wheelDelta > 0)
            var fontSize = parseFloat(newSym.css("font-size")) * 1.1;
        else
            var fontSize = parseFloat(newSym.css("font-size")) / 1.1;
            
        newSym.css("font-size", fontSize + "px");
        var bounds = measureText(v, newSym.css("font"), fontSize, fontSize * 2);
        newSym.width(bounds.width);
        newSym.height(bounds.height);
        newSym.find("div").css("left", -bounds.left)
                          .css("top", -bounds.top);
        newSym.css("left", parseFloat(newSym.css("left")) - (newSym.width() - oldWidth)/2);
        newSym.css("top", parseFloat(newSym.css("top")) - (newSym.height() - oldHeight)/2);
        parse();
        e.preventDefault();
        return false;
    });
    */
    return newSym;
}

function setCanvasSize(canvas, width, height)
{
    canvas.attr("width", width).width(width)
          .attr("height", height).height(height);
}

function endsWith(str, pattern)
{
    return str.indexOf(pattern) == str.length - pattern.length;
}

function measureText(text, font, maxCharWidth, maxCharHeight)
{

    var c = $("<canvas/>");
    
    var width = Math.ceil(maxCharWidth*text.length);
    var height = Math.ceil(maxCharHeight);
    
    c.attr("width", width).width(width)
     .attr("height", height).height(height);
     
    var ctx = c[0].getContext("2d");

    ctx.textBaseline = "top";
    ctx.font = font;
    ctx.fillText(text, 0,0);
    
    var data = ctx.getImageData(0, 0, width, height).data;
    
    var minX = width;
    var maxX = 0;
    var minY = height;
    var maxY = 0;
    
    for (var y = 0; y < height; y++)
    {
        for (var x = 0; x < width; x++)
        {
            var i = y * width * 4 + x * 4;
            if (data[i+3])
            {
                //console.log("Pixel at",x,y);
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    return {top: minY - 1,
            left: minX - 1,
            width: maxX - minX + 3,
            height: maxY - minY + 3};
}

function select(symbols)
{
    $(".symbol").removeClass("selected");
    selectedSymbols = [];
    if (symbols)
    {
		for(var si in symbols)
		{
			symbols[si].addClass("selected");
			selectedSymbols.push(symbols[si]);
		}
    }
}


function parse()
{
    console.log("Parse!");
    var symbols = $("#canvas .symbol");
    objs = [];
	var id = 13;
    symbols.each(function(i,s)
    {
        var obj = {token: $(s).data("token"),
                   top: $(s).position().top,
                   left: $(s).position().left,
                   width: $(s).width(),
                   height: $(s).height(),
				   id: $(s).data("eqId"),
                   type: $(s).data("type")};
                   
        if ($(s).data("prec"))
        {
            obj.prec = $(s).data("prec");
        }
        
        objs.push(obj);
    });
	
    
    console.log(objs);
    
    $.ajax({url: "parse", 
            method: "post",
            contentType: "application/json",
            data: JSON.stringify(objs),
			dataType: "json",
            success: function(data)
                {
                    console.log("Return:", data);
                    $("#output").html(data.mathml);
					$(".symbol").removeClass("unused");
					for (var i in data.unusedSymbols)
					{
						$(".symbol[data-eq-id=\"" + data.unusedSymbols[i] + "\"]").addClass("unused");
					}
					for (var i in data.overlap)
					{
						$(".symbol[data-eq-id=\"" + data.unusedSymbols[i] + "\"]").addClass("overlap");
					}
					
                    MathJax.Hub.Queue(["Typeset",MathJax.Hub,"output"]);
                },
            error: function(e)
                {
                    console.error(e);
                    $("#output").html("");
                }
            });
}


