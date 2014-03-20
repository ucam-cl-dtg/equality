define(function(require) {
	
	var $ = require("jquery");

	var React = require("react");

	React.initializeTouchEvents(true);
	require("rsvp");
RSVP.on('error', function(reason) {
  console.error(reason);
  console.error(reason.message, reason.stack);
});

	(function($){
		$.fn.disableSelection = function() {
		    return this
		             .attr('unselectable', 'on')
		             .css('user-select', 'none')
		             .on('selectstart', false);
		};
	})($);

	var loadMathJax = new RSVP.Promise(function(resolve, reject)
	{
		MathJax.Hub.Startup.signal.Interest(function (message) {
			//console.log("MathJax Startup:", message)
			if (message == "End") {
				resolve();
			}
		});

	})
/////////////////////////////////
// Constructor
/////////////////////////////////

	function EquationEditor(container) {
		console.log("Creating Equation Editor in", container);

		loadMathJax.then(function() {
			this.editor = <Editor />

			React.renderComponent(this.editor, container);			
		})
	}

/////////////////////////////////
// Private static methods
/////////////////////////////////

	function absorbEvent(e) {
		e.preventDefault();
		return false;
	}

	function nop() { }

	function getFontForToken(token, size) {
    	var code = token.charCodeAt(0);

	    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122))
	        return $("#mathjax-dummy .mi").css("font-size", size).css("font");
	    else
	        return $("#mathjax-dummy .mn").css("font-size", size).css("font");
	}

	function measureText(text, font, maxCharWidth, maxCharHeight) {

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

	var nextSymbolKey = 0;

	function getNextSymbolKey() {
		return "sym-" + (nextSymbolKey++);
	}

/////////////////////////////////
// Private static component classes
/////////////////////////////////

	function InteractionHandler(element, grabHandler, dragHandler, dropHandler, clickHandler) {

		var grabPageX, grabPageY;
		var lastDx = 0, lastDy = 0;

		var this_Grab = function(pageX, pageY, e) {

			var offset = $(element).offset();
			
			if (grabHandler)
				grabHandler(pageX, pageY, pageX - offset.left, pageY - offset.top, e);

			grabPageX = pageX;
			grabPageY = pageY;
			lastDx = 0;
			lastDy = 0;

			window.addEventListener("mousemove", window_MouseMove);
			window.addEventListener("touchmove", window_TouchMove);
			window.addEventListener("mouseup", window_MouseUp);
			window.addEventListener("touchend", window_TouchEnd);

			e.preventDefault();
			e.stopPropagation();
		}

		var this_Drag = function(pageX, pageY, e) {

			var dx = pageX - grabPageX;
			var dy = pageY - grabPageY;

			if (dragHandler)
				dragHandler(dx, dy, dx - lastDx, dy - lastDy, e);

			lastDx = dx;
			lastDy = dy;

			e.preventDefault();
			e.stopPropagation();
		}

		var this_Drop = function(pageX, pageY, e) {

			var dx = pageX - grabPageX;
			var dy = pageY - grabPageY;
			var offset = $(element).offset();

			var localX = pageX - offset.left;
			var localY = pageY - offset.top;

			if (dropHandler)
				dropHandler(pageX, pageY, dx, dy, localX, localY, e);

			if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && clickHandler)
				clickHandler(pageX, pageY, localX, localY, e);


			window.removeEventListener("mousemove", window_MouseMove);
			window.removeEventListener("touchmove", window_TouchMove);
			window.removeEventListener("mouseup", window_MouseUp);
			window.removeEventListener("touchend", window_TouchEnd);

			e.preventDefault();
			e.stopPropagation();
		}

		var this_mouseDown = function(e) {
			this_Grab(e.pageX, e.pageY, e);
		}

		var window_MouseMove = function(e) {
			this_Drag(e.pageX, e.pageY, e);
		}

		var window_MouseUp = function(e) {
			this_Drop(e.pageX, e.pageY, e);
		}

		var this_TouchStart = function(e) {
			if(e.touches.length == 1) 
				this_Grab(e.touches[0].pageX, e.touches[0].pageY, e);
		}

		var window_TouchMove = function(e) {
			if (e.touches.length == 1)
				this_Drag(e.touches[0].pageX, e.touches[0].pageY, e);
		}

		var window_TouchEnd = function(e) {
			if (e.changedTouches.length == 1) 
				this_Drop(e.changedTouches[0].pageX, e.changedTouches[0].pageY, e);
		}

		element.addEventListener("mousedown", this_mouseDown);
		element.addEventListener("touchstart", this_TouchStart);

		this.removeHandlers = function() {
			element.removeEventListener("mousedown", this_mouseDown);
			element.removeEventListener("touchstart", this_TouchStart);
		}
	}

	var Deletable = {

		componentDidMount: function() {
			this.deleteHandler = new InteractionHandler(this.refs.deleteHandle.getDOMNode(), null, null, null, this.delete_Click);
		},

		componentWillUnmount: function() {
			this.deleteHandler.removeHandlers();
		},

		delete_Click: function(pageX, pageY, e) {
			if (this.props.onDelete)
				this.props.onDelete(this.props.key);
		},
	};

	var Movable = {

		componentDidMount: function() {
			if (this.props.onMove || this.props.onGrab) {
				this.moveHandler = new InteractionHandler(this.refs.moveHandle.getDOMNode(), this.move_Grab, this.move_Drag);
				this.grabMoveHandler = new InteractionHandler(this.refs.grabRegion.getDOMNode(), this.move_Grab, this.move_Drag);
			}
		},

		componentWillUnmount: function() {
			if (this.props.onMove || this.props.onGrab) {
				this.moveHandler.removeHandlers();
				this.grabMoveHandler.removeHandlers();
			}
		},

		move_Grab: function(pageX, pageY, localX, localY, e) {

			this.setState({
				grabPosX: this.props.x,
				grabPosY: this.props.y,
			})

			if (this.props.onGrab)
				this.props.onGrab(localX,localY,this.props.key,e);
		},

		move_Drag: function(totalDx, totalDy, dx, dy, e) {
			if (this.props.onMove)
				this.props.onMove(dx, dy, this.props.key);
		},
	};

	var Selectable = {
		componentDidMount: function() {
			if (this.props.onSelect)
				this.selectHandler = new InteractionHandler(this.refs.grabRegion.getDOMNode(), null, null, null, this.select);	
		},

		componentWillUnmount: function() {
			if (this.props.onSelect)
				this.selectHandler.removeHandlers();
		},

		select: function() {
			if (this.props.onSelect)
				this.props.onSelect(this.props.key);
		}
	}

	var ResizableSymbol = {

		componentDidMount: function() {
			this.resizeHandler = new InteractionHandler(this.refs.resizeHandle.getDOMNode(), this.resize_Grab, this.resize_Drag);	
		},

		componentWillUnmount: function() {
			this.resizeHandler.removeHandlers();
		},

		resize_Grab: function() {
			this.startResize();
		},

		resize_Drag: function(totalDx, totalDy, dx, dy) {
			this.resize(totalDx, totalDy, dx, dy);
		},
	};

	var ResizableBoxSymbol =  {

		mixins: [ResizableSymbol],

		startResize: function() {
			this.setState({
				resizeGrabWidth: this.props.spec.width, 
				resizeGrabHeight: this.props.spec.height, 
				resizeGrabX: this.props.x, 
				resizeGrabY: this.props.y
			});
		},

		resize: function(totalDx, totalDy, dx, dy) {

			var totalDx = Math.max(totalDx, 10 - this.state.resizeGrabWidth);
			var totalDy = Math.max(totalDy, 10 - this.state.resizeGrabHeight);

			this.props.onMove(this.state.resizeGrabX + totalDx / 2 - this.props.x, this.state.resizeGrabY + totalDy / 2 - this.props.y, this.props.key);

			this.props.spec.width = this.state.resizeGrabWidth + totalDx;
			this.props.spec.height = this.state.resizeGrabHeight + totalDy;

			this.props.onSpecChange(this.props.spec, this.props.key);
		},
	};

	var TextSymbol = React.createClass({

		mixins: [Selectable, ResizableSymbol, Movable, Deletable],

		startResize: function() {
			this.setState({
				resizeGrabFontSize: this.props.spec.fontSize,
			})
		},

		resize: function(totalDx, totalDy, dx, dy) {
			this.props.spec.fontSize = this.state.resizeGrabFontSize + Math.max(totalDx, totalDy) * 4;

			this.props.spec.fontSize = Math.max(5, this.props.spec.fontSize);
			this.props.onSpecChange(this.props.spec, this.props.key);
		},

		render: function() {

			// Select which font to use, depending on the first character of the token.
			// Once we've chosen, resize the dummy mathjax to our required size, then ask for the font spec.

	    	var font = getFontForToken(this.props.spec.token, this.props.spec.fontSize);

		    // Get the left,top,width,height of the actual rendered character.

    		var bounds = measureText(this.props.spec.token, font, this.props.spec.fontSize, this.props.spec.fontSize * 2);

    		var classes = React.addons.classSet({
    			symbol: true,
    			selected: this.props.selected,
    			allowMoveHandle: this.props.allowMoveHandle,
    			allowResizeHandle: this.props.allowResizeHandle,
    			allowDeleteHandle: this.props.allowDeleteHandle,
    		});

			return (
				<div className={classes} 
					style={{
						width: bounds.width,
						height: bounds.height,
						left: this.props.x - bounds.width / 2,
						top: this.props.y - bounds.height / 2,
						font: font,
						fontSize: this.props.spec.fontSize,
					}}>

					<div className="symbol-content" 
						style={{
							left: -bounds.left, // N.B. This clips the whitespace from the top and left!
							top: -bounds.top,
						}}>

						{this.props.spec.token}

					</div>
					<div className="selection-outline" style={{display: this.props.selected ? "block" : "none" }}/>
					<div className="symbol-grab-region" ref="grabRegion"/>
					<div className="symbol-resize handle" ref="resizeHandle" />
					<div className="symbol-move handle" ref="moveHandle" />
					<div className="symbol-delete handle" ref="deleteHandle" />
				</div>
			);
		}
	});

	var SqrtSymbol = React.createClass({

		mixins: [Selectable, ResizableBoxSymbol, Movable, Deletable],

		redraw: function() {
			var n = $(this.refs.canvas.getDOMNode())
			var width = n.width();
			var height = n.height();

			n.attr({width: width, height: height});

			var ctx = n[0].getContext("2d");
			ctx.lineWidth = 1.5;

			ctx.beginPath();
			ctx.moveTo(0,0.8 * height);
			ctx.lineTo(0.1 * height, height);
			ctx.lineTo(0.2 * height, 2);
			ctx.lineTo(width, 2);
			ctx.stroke();
		},

		componentDidMount: function() {
			this.redraw();
		},

		componentDidUpdate: function() {
			this.redraw();
		},

		render: function() {

    		var classes = React.addons.classSet({
    			symbol: true,
    			container: true,
    			selected: this.props.selected,
    			allowMoveHandle: this.props.allowMoveHandle,
    			allowResizeHandle: this.props.allowResizeHandle,
    			allowDeleteHandle: this.props.allowDeleteHandle,
    		});

    		var grabRegionWidth = this.props.spec.height * 0.25;

			return (
				<div className={classes} 
					style={{
						width: this.props.spec.width,
						height: this.props.spec.height,
						left: this.props.x - this.props.spec.width / 2,
						top: this.props.y - this.props.spec.height / 2,
					}}>

					<canvas className="symbol-content sqrt" 
						ref="canvas">

					</canvas>
					<div className="selection-outline" style={{display: this.props.selected ? "block" : "none" }}/>
					<div className="symbol-grab-region" ref="grabRegion"
						style={{
							width: grabRegionWidth,
							height: this.props.spec.height,
						}} />
					<div className="symbol-resize handle" ref="resizeHandle" />
					<div className="symbol-move handle" ref="moveHandle" />
					<div className="symbol-delete handle" ref="deleteHandle" />
				</div>
			);
		}
	});

	var ContainerSymbol = React.createClass({

		symbolSubTypeMap: {
			"sqrt": SqrtSymbol,
		},

		render: function() {
			var SpecializedSymbol = this.symbolSubTypeMap[this.props.spec.subType];
			var c = SpecializedSymbol();
			return this.transferPropsTo(c);
		}
	})

	var Symbol = React.createClass({

		symbolTypeMap: {
			"string": TextSymbol,
			"container": ContainerSymbol
		},

		render: function() {
			var SpecializedSymbol = this.symbolTypeMap[this.props.spec.type];
			var c = SpecializedSymbol();
			return this.transferPropsTo(c);
		}

	});

	var InputBox = React.createClass({

		getInitialState: function() {
			return {
				value: "",
				width: this.props.fontSize,
				font: getFontForToken("3", this.props.fontSize),
			};
		},

		componentDidMount: function() {
			this.getDOMNode().focus();
			$(this.getDOMNode()).blur(this.commit);
		},

		componentWillReceiveProps: function(next) {
			this.getDOMNode().focus();
		},

		componentWillUnmount: function() {
			$(this.getDOMNode()).off("blur");
		},

		inputBox_Change: function(e) {

			var d = $("<div/>").html(e.target.value)
	                .css("font", $(this.getDOMNode()).css("font"))
					.css("display", "none")
					.appendTo($("body"));

			var newWidth = Math.max(d.width() + this.props.fontSize/2, this.props.fontSize);

			d.remove();

			this.setState({
				font: getFontForToken(e.target.value, this.props.fontSize),
				value: e.target.value,
				width: newWidth,
			});
		},

		inputBox_KeyUp: function(e) {
			switch(e.which) {
				case 13:
					this.commit();
					e.preventDefault();
					e.stopPropagation();
					break;
				case 27:
					this.props.onCancel();
					e.preventDefault();
					e.stopPropagation();
					break;
			}
		},

		commit: function() {
			this.props.onCommit(this.props.x - this.props.fontSize / 2 + this.state.width / 2, this.props.y, this.props.fontSize, this.state.value);			
		},

		render: function() {

			return (
				<input type="text" 
					className="token-input"
					ref="inputBox"
					value={this.state.value}
					onChange={this.inputBox_Change}
					onKeyUp={this.inputBox_KeyUp}
					onMouseDown={absorbEvent}
					onMouseUp={absorbEvent}
					onClick={absorbEvent}
					onMouseMove={absorbEvent}
					style={{
						left: this.props.x - this.props.fontSize / 2,
						top: this.props.y - this.props.fontSize / 2,
						width: this.state.width,
						font: this.state.font,
						textAlign: this.state.value.length < 2 ? "center" : "left",
						paddingLeft: this.state.value.length < 2 ? 0 : this.props.fontSize / 4,
					}}/>
			);
		},
	});

	var SelectionBox = React.createClass({

		getInitialState: function() {
			return {
				width: 0,
				height: 0,
			};
		},

		window_DragMove: function(x, y) {
			
			this.setState({
				width: x - this.props.originX,
				height: y - this.props.originY,
			})
		},

		window_Drop: function() {

			this.props.onCommit(this.getBounds());
		},

		window_MouseMove: function(e) {

			var offset = $(this.getDOMNode()).parent().offset();
			var x = e.pageX - offset.left
			var y = e.pageY - offset.top

			this.window_DragMove(x,y);
		},

		window_MouseUp: function(e) {
			this.window_Drop();
		},

		window_TouchMove: function(e) {
			if (e.touches.length == 1) {

				var offset = $(this.getDOMNode()).parent().offset();
				var x = e.touches[0].pageX - offset.left;
				var y = e.touches[0].pageY - offset.top;

				 this.window_DragMove(x,y);
			}
			e.preventDefault();
			return false;
		},

		window_TouchEnd: function(e) {
			if (e.changedTouches.length == 1)
				this.window_Drop();
		},

		componentDidMount: function() {
			window.addEventListener("mousemove", this.window_MouseMove);
			window.addEventListener("mouseup", this.window_MouseUp);
			window.addEventListener("touchmove", this.window_TouchMove);
			window.addEventListener("touchend", this.window_TouchEnd);
		},

		componentWillUnmount: function() {	
			window.removeEventListener("mousemove", this.window_MouseMove);
			window.removeEventListener("mouseup", this.window_MouseUp);
			window.removeEventListener("touchmove", this.window_TouchMove)
			window.removeEventListener("touchend", this.window_TouchEnd);
		},

		getBounds: function() {
			return {
				left: this.state.width < 0 ? this.props.originX + this.state.width : this.props.originX,
				top: this.state.height < 0 ? this.props.originY + this.state.height : this.props.originY,
				width: Math.abs(this.state.width),
				height: Math.abs(this.state.height),
			}
		},

		render: function() {
			return (
				<div className="selection-box"
					style={this.getBounds()} />
			);
		}
	})

	var CanvasComponent = React.createClass({

		getInitialState: function() {
			return {
				symbols: {
					"sym-a": {selected: true, x:100, y:100, spec: {type: "string", fontSize: 48, token: "x"}},
					"sym-b": {selected: true, x:200, y:100, spec: {type: "container", subType: "sqrt", width: 100, height: 100}},
				},
				inputBox: null,
				draggingSymbols: null,
				selectionBox: null,
			};
		},

		addSymbol: function(x,y,spec) {
			var newKey = getNextSymbolKey();

			this.state.symbols[newKey] = {x:x, y:y, spec:spec};
			this.forceUpdate();

			return newKey;
		},

		input_cancel: function() {
			this.setState({inputBox: null});
		},

		input_commit: function(x, y, fontSize, token) {

			token = token.trim();

			if(!token) {
				this.setState({inputBox: null});
				return;
			}

			this.addSymbol(x,y,{
				type: "string",
				fontSize: fontSize,
				token: token,
			});

			this.setState({
				inputBox: null,
			});
		},

		selection_commit: function(bounds) {

			for (var i in this.state.symbols) {
				var s = this.state.symbols[i];

				s.selected = (s.x > bounds.left && s.x < bounds.left + bounds.width &&
							  s.y > bounds.top && s.y < bounds.top + bounds.height);
			}

			this.forceUpdate();

			this.setState({selectionBox: null});
		},

		injectSymbol: function(pageX, pageY, spec) {

			var canvasOffset = $(this.getDOMNode()).offset();

			var x = pageX - canvasOffset.left;
			var y = pageY - canvasOffset.top;

			var newKey = this.addSymbol(x, y, spec);

			return newKey; // key of new symbol
		},

		deselectSymbols: function() {

			var deselected = 0;

			for(var i in this.state.symbols) {
				var sym = this.state.symbols[i];
				if (sym.selected) {
					deselected++;
					sym.selected = false;
				}
			}

			this.forceUpdate();

			return deselected;
		},

		getSelectedSymbolKeys: function() {
			var selected = [];

			for(var k in this.state.symbols)
				if (this.state.symbols[k].selected)
					selected.push(k);

			return selected;
		},

		symbol_Grab: function(k) {

			// If we're currently displaying the input box, remove it.
			if (this.state.inputBox)
				this.refs.inputBox.commit();
		},

		symbol_Move: function(dx, dy, k) {

			// Move this symbol

			this.state.symbols[k].x += dx;
			this.state.symbols[k].y += dy;

			// If this symbol is not selected, make sure nothing else is either
			if (!this.state.symbols[k].selected)
				this.deselectSymbols();

			// Move all OTHER selected symbols

			selectedSymbolsKeys = this.getSelectedSymbolKeys();

			for(var j in selectedSymbolsKeys) {
				j = selectedSymbolsKeys[j];

				if (j == k)
					continue;

				this.state.symbols[j].x += dx;
				this.state.symbols[j].y += dy;				
			}

			this.forceUpdate();
		},

		symbol_Select: function(k) {
			this.deselectSymbols();
			this.state.symbols[k].selected = true;
			this.forceUpdate();
		},

		symbol_SpecChange: function(newSpec, k) {

			for(var a in newSpec)
				this.state.symbols[k][a] = newSpec[a];

			this.forceUpdate();
		},

		symbol_Delete: function(k) {
			delete this.state.symbols[k];

			var ks = this.getSelectedSymbolKeys();
			for(var k in ks) {
				delete this.state.symbols[ks[k]];
			}

			this.forceUpdate();
		},

		componentDidMount: function() {

			// Disable text selection as much as we can, so that we can drag things around.
			$(this.getDOMNode()).on("selectstart", function() { return false;})
			$(this.getDOMNode()).parents().on("selectstart", function() { return false;})

			// Listen for key presses.
			window.addEventListener("keydown", this.window_KeyDown);

			this.canvasHandler = new InteractionHandler(this.getDOMNode(), this.canvas_Grab, this.canvas_Drag, this.canvas_Drop, this.canvas_Click);
		},

		canvas_Grab: function(pageX, pageY, e) {
		},

		canvas_Drag: function(totalDx, totalDy, dx, dy, e) {
			
			for(var k in this.state.symbols) {
				var symbol = this.state.symbols[k];

				symbol.x += dx;
				symbol.y += dy;
			}

			this.forceUpdate();
		},

		canvas_Drop: function(pageX, pageY, e) {
		},

		canvas_Click: function(pageX, pageY, localX, localY, e) {

			var deselected = this.deselectSymbols();

			if (deselected == 0) {

				var fontSize = parseFloat($(this.getDOMNode()).css("font-size"));

				var inputBox = {x: localX, y: localY, fontSize: fontSize};

				this.setState({inputBox: inputBox});					

			}
		},

		window_KeyDown: function(e) {
			switch(e.which){
				case 46:

				this.symbol_Delete();

				break;
			}
		},

		render: function() {

			if (this.state.selectionBox)
				var selectionBox = <SelectionBox originX={this.state.selectionBox.originX} originY={this.state.selectionBox.originY} onCommit={this.selection_commit} key="selectionBox" ref="selectionBox"/>

			if (this.state.inputBox)
				var inputBox = <InputBox x={this.state.inputBox.x} y={this.state.inputBox.y} fontSize={this.state.inputBox.fontSize} onCommit={this.input_commit} onCancel={this.input_cancel} key="inputBox" ref="inputBox"/>;
			
			var symbols = [];
			var allowMoveHandle = true;
			var allowResizeHandle = this.getSelectedSymbolKeys().length <= 1;
			var allowDeleteHandle = true;
			for(var k in this.state.symbols) {
				var s = this.state.symbols[k];

				var c = <Symbol 
							onSelect={this.symbol_Select}
							onGrab={this.symbol_Grab}
							onMove={this.symbol_Move}
							onSpecChange={this.symbol_SpecChange}
							onDelete={this.symbol_Delete}
							x = {s.x}
							y = {s.y}
							spec={s.spec}
							selected={s.selected} 
							allowMoveHandle={allowMoveHandle}
							allowResizeHandle={allowResizeHandle}
							allowDeleteHandle={allowDeleteHandle}
							key={k}
							ref={"symbol" + k}/>;

				symbols.push(c);
				
				if (s.selected) {
					allowMoveHandle = false;
					allowDeleteHandle = false;
				}
			}

			return (
				<div className="equation-canvas" 
					onMouseDown={this.canvas_MouseDown}
					onMouseUp={this.canvas_MouseUp}
					onTouchStart={this.canvas_TouchStart}
					onTouchEnd={this.canvas_TouchEnd}>
					{symbols}
					{inputBox}
					{selectionBox}
				</div>
			);
		}
	});

	var SymbolMenu = React.createClass({

		getDefaultProps: function() {
			return {
				btnSize: 50,
				orientation: "vertical",
				symbols: [],
			};
		},

		spawnSymbol: function(grabX, grabY, i) {

			var src = this.refs["symbol" + i];
			var srcBtn = this.refs["button" + i];

			var offset = $(srcBtn.getDOMNode()).offset();

			this.props.onSpawnSymbol(offset.left + src.props.x, offset.top + src.props.y, $.extend({},this.props.symbols[i]), grabX, grabY);

			$(src.getDOMNode()).hide().fadeIn(1000);
		},

		render: function() {

			var symbols = [];

			var btnWidth = this.props.orientation == "vertical" ? this.props.width : this.props.btnSize;
			var btnHeight = this.props.orientation == "vertical" ? this.props.btnSize : this.props.height;

			for (var i = 0; i < this.props.symbols.length; i++) {
				
				(function(i) {

					var spawnMouse = function(e) {
						var offset = $(this.refs["symbol" + i].getDOMNode()).offset();
						this.spawnSymbol(e.pageX - offset.left, e.pageY - offset.top, i);

					}.bind(this);

					var spawnTouch = function(e) {
						if (e.touches.length == 1) {
							var offset = $(this.refs["symbol" + i].getDOMNode()).offset();
							this.spawnSymbol(e.touches[0].pageX - offset.left, e.touches[0].pageY - offset.top ,i);
						}

					}.bind(this);

					var symbolSpec = this.props.symbols[i];

					var symbol = (
						<li className="symbol-button" onMouseDown={spawnMouse} onTouchStart={spawnTouch} ref={"button" + i} key={i} style={{
							left: this.props.orientation == "vertical" ? 0 : this.props.btnSize * i,
							top: this.props.orientation == "vertical" ? this.props.btnSize * i : 0,
							width: btnWidth,
							height: btnHeight,

						}}>
							<Symbol x={btnWidth/2} y={btnHeight/2} spec={symbolSpec} key={i} ref={"symbol" + i }/>
						</li>
					);

					symbols.push(symbol);

				}).bind(this)(i);
			}


			return (
				<ul className="symbol-menu" style={{
					left: this.props.left,
					top: this.props.top,
					right: this.props.right,
					bottom: this.props.bottom,
					width: this.props.width,
					height: this.props.height,
				}}>
					{symbols}
				</ul>
			);
		}
	});

	var Editor = React.createClass({

		menu_SpawnSymbol: function(pageX, pageY, spec, grabX, grabY) {

			var newSymbolKey = this.refs.canvas.injectSymbol(pageX, pageY, spec);
			//this.refs.canvas.symbol_Grab(grabX, grabY, newSymbolKey);
		},

		render: function() {
			

			var leftMenuSymbols = [
				{
					type: "string",
					fontSize: 48,
					token: "+"
				},
				{
					type: "string",
					fontSize: 48,
					token: "–"
				},
				{
					type: "string",
					fontSize: 48,
					token: "="
				},
				{
					type: "container",
					width: 48,
					height: 36,
					subType: "sqrt"
				}
			];

			var rightMenuSymbols = [
				{
					type: "string",
					fontSize: 48,
					token: "x"
				},
				{
					type: "string",
					fontSize: 48,
					token: "y"
				},
				{
					type: "string",
					fontSize: 48,
					token: "z"
				}
			];

			return (
				<div className="equation-editor">
					<CanvasComponent ref="canvas"/>
					<SymbolMenu left={0} top={80} width={80} btnSize={80} symbols={leftMenuSymbols} onSpawnSymbol={this.menu_SpawnSymbol} />
					<SymbolMenu right={0} top={80} width={80} btnSize={80} symbols={rightMenuSymbols} onSpawnSymbol={this.menu_SpawnSymbol} />
				</div>
			);
		}
	});

	return EquationEditor;
});