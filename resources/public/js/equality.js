var dragStartPos = null;
var draggingSymbol = null;
var draggingSymbolStartPos = null;

var selectedSymbol = null;

var inputBox = null;

var symbols = ["+", "-", "="];
var fracAspectRatio = 100;

$(function ()
{
   // Document ready
    
    $("body").on("click", "button.parse", function(e)
    {
        parse();
    });

    $("#canvas").on("mousedown", ".symbol", function(e)
    {
        //console.log($(e.target).position(), e.pageX, e.pageY);
        dragStartPos = {x: e.pageX, y: e.pageY};
        draggingSymbolStartPos = $(e.target).closest(".symbol").position();
        draggingSymbol = $(e.target).closest(".symbol");
        select($(e.target).closest(".symbol"));
    });
    
    $("#canvas").on("mouseup", function(e)
    {
        if ($(e.target).filter("#canvas").length > 0)
        {
            select(null);
            var newBox = $('<input type="text"/>').css("position", "absolute")
                                     .css("left", e.pageX - $(e.target).position().left - parseFloat($("#canvas").css("font-size")) / 2)
                                     .css("top", e.pageY - $(e.target).position().top - parseFloat($("#canvas").css("font-size")) / 2)
                                     .css("width", $("#canvas").css("font-size"))
                                     .css("height", $("#canvas").css("font-size"))
                                     .css("text-align", "center")
                                     .css("font", $("#canvas").css("font"))
                                     .appendTo($("#canvas"))
                                     .blur(function(e) { commitNew(newBox); })
                                     .keydown(function(e)
                                     {
                                        if (e.which == 13) // enter
                                            commitNew(newBox);
                                        else if (e.which == 27) // escape
                                            newBox.remove();
                                     });
            newBox.focus();
            e.preventDefault();
            return false;
        }
        
    });
  
    $("#canvas").on("mouseup", function(e)
    {
        dragStartPos = null;
        draggingSymbol = null;
        draggingSymbolStartPos = null;
        parse();
    });
    
    $("#canvas").on("mousemove", function(e)
    {
        if (draggingSymbol)
        {
            var dx = e.pageX -dragStartPos.x;
            var dy = e.pageY - dragStartPos.y;
            
            draggingSymbol.css("left", draggingSymbolStartPos.left + dx);
            draggingSymbol.css("top", draggingSymbolStartPos.top + dy);
        }
    });
    
    $("body").on("keydown", function(e)
    {
        console.log(e);
        if(e.which == 46 && selectedSymbol)
        {
            console.log(e);
            selectedSymbol.remove();
            parse();
        }
    });

});

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function commitNew(box)
{
    var val = box[0].value;
    
    if (!val)
    {
        console.error("No input provided");
        box.remove();
        return;
    }
    if (!isNumber(val) && val.length != 1)
    {
        console.error("Invalid input");
        box.remove();
        return;
    }
    
    switch(val)
    {
        case "/":
            var newSym = genFrac(parseFloat(box.css("left")) + box.width() / 2, parseFloat(box.css("top")) + box.height() / 2, 40);
            newSym.data("token", ":frac");
            newSym.data("type", "type/symbol");
            
            break;
        default:
            var newSym = genSym(val, parseFloat(box.css("left")) + box.width()/2, parseFloat(box.css("top")) + box.height()/2);
            newSym.data("token", val);
            newSym.data("type", "type/symbol");
            break;
    }
    
    $("#canvas").append(newSym);
    parse();
    box.remove();
}

function genFrac(x, y, width)
{
    var newSym = $('<canvas/>').addClass("symbol");
    newSym.css("left",x - width /2);
    newSym.css("top", y);
    newSym.css("width", width);
    
    newSym.css("background", "black");
    newSym.css("height", Math.max(1, width / fracAspectRatio));
    
    newSym.on("mousewheel", function(e)
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
    });
    
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
                            .append($("<div/>").css("position", "absolute")
                                               .css("left", -bounds.left)
                                               .css("top", -bounds.top)
                                               .html(v));
    
    newSym.css("left",x - bounds.width/2);
    newSym.css("top", y - bounds.height/2);
    
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

function select(symbol)
{
    $(".symbol").removeClass("selected");
    selectedSymbol = null;
    if (symbol)
    {
        symbol.addClass("selected");
        selectedSymbol = symbol;
    }
}


function parse()
{
    console.log("Parse!");
    var symbols = $("#canvas .symbol");
    objs = [];
    symbols.each(function(i,s)
    {
        var obj = {token: $(s).data("token"),
                   top: $(s).position().top,
                   left: $(s).position().left,
                   width: $(s).width(),
                   height: $(s).height(),
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
            success: function(data)
                {
                    console.log("Return:", data);
                    $("#output").html(data);
                    MathJax.Hub.Queue(["Typeset",MathJax.Hub,"output"]);
                },
            error: function(e)
                {
                    console.error(e);
                    $("#output").html("");
                }
            });
}