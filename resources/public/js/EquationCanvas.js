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

	function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
	function absorbEvent(e) {
		e.preventDefault();
		return false;
	}

	function generateStringSymbolSpecs(tokens) 
	{ 
		var specs = [];

		for (var t in tokens) {
			t = tokens[t];

			specs.push({
				fontSize: 48,
				type: "string",
				token: t,
			});
		}

		return specs;
	}

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

	function resizeSymbol(s, startSnapshot, totalDx, totalDy) {
		switch(s.spec.type) {
			case "string":
				
				s.spec.fontSize = Math.max(5, startSnapshot.spec.fontSize + Math.max(totalDx, totalDy) * 4);
				
				break;
			case "container":
				
				var newTotalDx = Math.max(totalDx, 10 - startSnapshot.spec.width);
				var newTotalDy = Math.max(totalDy, 10 - startSnapshot.spec.height);

				s.x = startSnapshot.x + newTotalDx / 2;
				s.y = startSnapshot.y + newTotalDy / 2;

				s.spec.width = startSnapshot.spec.width + newTotalDx;
				s.spec.height = startSnapshot.spec.height + newTotalDy;

				break;
		}
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
			window.addEventListener("touchcancel", window_TouchCancel);

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

			var totalDx = pageX - grabPageX;
			var totalDy = pageY - grabPageY;
			var offset = $(element).offset();

			var localX = pageX - offset.left;
			var localY = pageY - offset.top;

			if (dropHandler)
				dropHandler(pageX, pageY, totalDx, totalDy, localX, localY, e);

			if (Math.abs(totalDx) < 2 && Math.abs(totalDy) < 2 && clickHandler)
				clickHandler(pageX, pageY, localX, localY, e);


			window.removeEventListener("mousemove", window_MouseMove);
			window.removeEventListener("touchmove", window_TouchMove);
			window.removeEventListener("mouseup", window_MouseUp);
			window.removeEventListener("touchend", window_TouchEnd);
			window.removeEventListener("touchcancel", window_TouchEnd);

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

		var window_TouchCancel = function(e) {
			console.warn("Touch cancelled. This shouldn't have happened.", e);
		}

		element.addEventListener("mousedown", this_mouseDown);
		element.addEventListener("touchstart", this_TouchStart);

		this.removeHandlers = function() {
			element.removeEventListener("mousedown", this_mouseDown);
			element.removeEventListener("touchstart", this_TouchStart);
		}
	}

	var Mountable = {
		componentDidMount: function() {
			if (this.props.onMount)
				this.props.onMount();
		},
		componentWillUnmount: function() {
			if (this.props.onUnmount)
				this.props.onUnmount();
		}
	}

	var TextSymbol = React.createClass({

		mixins: [Mountable],

		statics: {
			getBounds: function(props) {
		    	var font = getFontForToken(props.spec.token, props.spec.fontSize);
				var bounds = measureText(props.spec.token, font, props.spec.fontSize, props.spec.fontSize * 2);
				return {
					left: props.x - bounds.width / 2,
					top: props.y - bounds.height / 2,
					width: bounds.width,
					height: bounds.height,
				};
			},
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
							left: -bounds.left, // N.B. This clips the whitespace from the top and left of the character!
							top: -bounds.top,
						}}>

						{this.props.spec.token}

					</div>
				</div>
			);
		}
	});

	var SqrtSymbol = React.createClass({

		mixins: [Mountable],

		statics: {
			getBounds: function(props) {
				return {
					left: props.x - props.spec.width / 2,
					top: props.y - props.spec.height / 2,
					width: props.spec.width,
					height: props.spec.height,
				};
			},
		},

		redraw: function() {
			var n = $(this.refs.canvas.getDOMNode())
			var width = n.width();
			var height = n.height();

			n.attr({width: width, height: height});

			var ctx = n[0].getContext("2d");
			ctx.lineWidth = Math.max(1.5, height / 40);
			ctx.strokeStyle = n.css("color");

			ctx.beginPath();
			ctx.moveTo(ctx.lineWidth,0.8 * height);
			ctx.lineTo(0.15 * height, height - ctx.lineWidth);
			ctx.lineTo(0.3 * height, ctx.lineWidth / 2);
			ctx.lineTo(width, ctx.lineWidth / 2);
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

				</div>
			);
		}
	});

	var ContainerSymbol = React.createClass({

		statics: {
			symbolSubTypeMap: {
				"sqrt": SqrtSymbol,
			},
			getBounds: function(props) {
				return ContainerSymbol.symbolSubTypeMap[props.spec.subType].getBounds(props);
			}
		},

		render: function() {
			var SpecializedSymbol = ContainerSymbol.symbolSubTypeMap[this.props.spec.subType];
			var c = SpecializedSymbol();
			return this.transferPropsTo(c);
		}
	})

	var Symbol = React.createClass({

		statics: {
			symbolTypeMap: {
				"string": TextSymbol,
				"container": ContainerSymbol
			},
			getBounds: function(props) {
				return Symbol.symbolTypeMap[props.spec.type].getBounds(props);
			},
		},

		render: function() {
			var SpecializedSymbol = Symbol.symbolTypeMap[this.props.spec.type];
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

	var Lasso = React.createClass({

		getBounds: function() {
			var width = this.props.oppositeX - this.props.originX;
			var height = this.props.oppositeY - this.props.originY;
			return {
				left: width < 0 ? this.props.originX + width : this.props.originX,
				top: height < 0 ? this.props.originY + height : this.props.originY,
				width: Math.abs(width),
				height: Math.abs(height),
			}
		},

		render: function() {
			return (
				<div className="lasso"
					style={this.getBounds()} />
			);
		}
	});

	var SelectionBox = React.createClass({

		componentDidMount: function() {
			this.moveHandler = new InteractionHandler(this.refs.moveHandle.getDOMNode(), null, this.props.onMove, this.props.onMoveEnd);
			this.deleteHandler = new InteractionHandler(this.refs.deleteHandle.getDOMNode(), null, null, null, this.props.onDelete);
			this.resizeHandler = new InteractionHandler(this.refs.resizeHandle.getDOMNode(), this.props.onStartResize, this.props.onResize);
		},

		componentWillUnmount: function() {
			this.moveHandler.removeHandlers();
			this.deleteHandler.removeHandlers();
			this.resizeHandler.removeHandlers();
		},

		render: function() {
			return (
				<div className="selection-box" style={{
					left: this.props.left - 5,
					top: this.props.top - 5,
					width: this.props.width + 10,
					height: this.props.height + 10}}>

					<div className="move handle" ref="moveHandle"/>
					<div className="delete handle" ref="deleteHandle"/>
					<div className="resize handle" ref="resizeHandle" style={this.props.allowResize ? {display: "block"} : {display: "none"}}/>
				</div>
			);
		}
	});

	var CanvasComponent = React.createClass({

		getInitialState: function() {
			return {
				symbols: {
					"sym-a": {selected: true, x:200, y:200, spec: {type: "string", fontSize: 48, token: "x"}},
					"sym-b": {selected: true, x:300, y:200, spec: {type: "container", subType: "sqrt", width: 100, height: 100}},
				},
				inputBox: null,
				draggingSymbols: null,
				selectionBox: null,
				touchMode: "pan",
			};
		},

		addSymbol: function(x,y,spec) {
			var newKey = getNextSymbolKey();

			this.state.symbols[newKey] = {x:x, y:y, spec:spec};
			this.forceUpdate();
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

		symbol_Mount: function(k) {
			if (!this.symbolHandlers)
				this.symbolHandlers = {};

			this.symbolHandlers[k] = new InteractionHandler(this.refs["symbol" + k].getDOMNode(), this.symbol_Grab.bind(this, k), this.symbol_Drag.bind(this, k), this.symbol_Drop.bind(this, k), this.symbol_Click.bind(this, k));
		},

		symbol_Unmount: function(k) {
			delete this.symbolHandlers[k];
		},

		symbol_Grab: function(key, pageX, pageY, localX, localY, e) {

			// If we're currently displaying the input box, remove it.
			if (this.state.inputBox)
				this.refs.inputBox.commit();
		},

		symbol_Drag: function(key, totalDx, totalDy, dx, dy, e) {
			// Move this symbol

			this.state.symbols[key].x += dx;
			this.state.symbols[key].y += dy;

			// If this symbol is not selected, make sure nothing else is either
			if (!this.state.symbols[key].selected)
				this.deselectSymbols();

			// Move all OTHER selected symbols

			selectedSymbolsKeys = this.getSelectedSymbolKeys();

			for(var j in selectedSymbolsKeys) {
				j = selectedSymbolsKeys[j];

				if (j == key)
					continue;

				this.state.symbols[j].x += dx;
				this.state.symbols[j].y += dy;				
			}

			this.forceUpdate();
		},

		symbol_Drop: function(key, pageX, pageY, totalDx, totalDy, localX, localY, e) {
			var n = $(this.getDOMNode())
			var width = n.width();
			var height = n.height();

			var ss = this.getSelectedSymbolKeys();

			if (ss.indexOf(key) < 0)
				ss.push(key);

			for(var k in ss) {
				k = ss[k];

				var x = this.state.symbols[k].x;
				var y = this.state.symbols[k].y;

				if (x > width || x < 0 || y < 0 || y > height) {
					delete this.state.symbols[k];
				}
			}

			this.forceUpdate();
		},

		symbol_Click: function(key, pageX, pageY, localX, localY, e) {

			if (e.ctrlKey) {
				this.state.symbols[key].selected = !this.state.symbols[key].selected;				
			} else {
				this.deselectSymbols();
				this.state.symbols[key].selected = true;				
			}

			this.forceUpdate();
		},

		selection_Move: function(totalDx, totalDy, dx, dy, e) {
			var ss = this.getSelectedSymbolKeys();

			for(var s in ss) {
				s = this.state.symbols[ss[s]];

				s.x += dx;
				s.y += dy;
			}

			this.forceUpdate();
		},

		selection_MoveEnd: function() {
			var n = $(this.getDOMNode())
			var width = n.width();
			var height = n.height();

			var ss = this.getSelectedSymbolKeys();

			for(var k in ss) {
				k = ss[k];

				var x = this.state.symbols[k].x;
				var y = this.state.symbols[k].y;

				if (x > width || x < 0 || y < 0 || y > height) {
					delete this.state.symbols[k];
				}
			}

			this.forceUpdate();
		},

		selection_Delete: function() {
			var ks = this.getSelectedSymbolKeys();
			for(var k in ks) {
				delete this.state.symbols[ks[k]];
			}

			this.forceUpdate();
		},

		selection_StartResize: function() {
			var ks = this.getSelectedSymbolKeys();
			var resizeSnapshots = {};
			for(var k in ks) {
				k = ks[k];
				var s = this.state.symbols[k];

				resizeSnapshots[k] = JSON.parse(JSON.stringify(s));
			}	

			this.setState({resizeSnapshots: resizeSnapshots});

		},

		selection_Resize: function(totalDx, totalDy, dx, dy, e) {
			var ks = this.getSelectedSymbolKeys();
			for(var k in ks) {
				k = ks[k];
				var s = this.state.symbols[k];

				resizeSymbol(s, this.state.resizeSnapshots[k], totalDx, totalDy);
			}	

			this.forceUpdate();
		},

		componentDidMount: function() {

			// Disable text selection as much as we can, so that we can drag things around.
			$(this.getDOMNode()).on("selectstart", function() { return false;})
			$(this.getDOMNode()).parents().on("selectstart", function() { return false;})
			$(this.getDOMNode()).on("contextmenu", function() { return false;})
			//$(this.getDOMNode()).parents().on("contextmenu", function() { return false;})

			$("*").on("touchmove", function(e) {e.preventDefault();});

			// Listen for key presses.
			window.addEventListener("keydown", this.window_KeyDown);

			this.canvasHandler = new InteractionHandler(this.getDOMNode(), this.canvas_Grab, this.canvas_Drag, this.canvas_Drop, this.canvas_Click);
		},

		canvas_Grab: function(pageX, pageY, localX, localY, e) {

			if (e.button == 2 || (e.touches && this.state.touchMode == "pan")) {
				this.setState({
					dragMode: "pan",
				})
			} else if (e.button == 0 || (e.touches && this.state.touchMode == "lasso")) {
				this.setState({
					dragMode: "lasso",
					lassoOriginX: localX,
					lassoOriginY: localY,
				})
			}
		},

		canvas_Drag: function(totalDx, totalDy, dx, dy, e) {
			
			// If we're currently displaying the input box, remove it.
			if (this.state.inputBox)
				this.refs.inputBox.commit();

			switch(this.state.dragMode) {
				case "pan":
					for(var k in this.state.symbols) {
						var symbol = this.state.symbols[k];

						symbol.x += dx;
						symbol.y += dy;
					}

					this.forceUpdate();
					break;
				case "lasso":
					var newOpX = this.state.lassoOriginX + totalDx;
					var newOpY = this.state.lassoOriginY + totalDy;

					this.deselectSymbols();

					var left = Math.min(this.state.lassoOriginX, this.state.lassoOppositeX);
					var top = Math.min(this.state.lassoOriginY, this.state.lassoOppositeY);
					var right = Math.max(this.state.lassoOriginX, this.state.lassoOppositeX);
					var bottom = Math.max(this.state.lassoOriginY, this.state.lassoOppositeY);

					for (var k in this.state.symbols) {
						var s = this.state.symbols[k];

						if (s.x > left && s.x < right && s.y > top && s.y < bottom)
							s.selected = true;
					}

					this.setState({
						lassoOppositeX: newOpX,
						lassoOppositeY: newOpY,
					});

					break;
			}

		},

		canvas_Drop: function(pageX, pageY, e) {
			switch(this.state.dragMode) {
				case "pan":
					break;
				case "lasso":
					this.setState({
						lassoOriginX: undefined,
						lassoOriginY: undefined,
						lassoOppositeX: undefined,
						lassoOppositeY: undefined,
					});
					break;
			}
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

				this.selection_Delete();

				break;
			}
		},

		render: function() {

			if (this.state.inputBox)
				var inputBox = <InputBox x={this.state.inputBox.x} y={this.state.inputBox.y} fontSize={this.state.inputBox.fontSize} onCommit={this.input_commit} onCancel={this.input_cancel} key="inputBox" ref="inputBox"/>;
			
			if (this.state.lassoOppositeX != undefined)
				var lasso = <Lasso originX={this.state.lassoOriginX} originY={this.state.lassoOriginY} oppositeX={this.state.lassoOppositeX} oppositeY={this.state.lassoOppositeY} />				
			
			
			var symbols = [];
			var bounds = null;
			var selectedCount = 0;
			for(var k in this.state.symbols) {
				var s = this.state.symbols[k];

				var c = <Symbol 
							onMount={this.symbol_Mount.bind(this, k)}
							onUnmount={this.symbol_Unmount.bind(this, k)}
							x = {s.x}
							y = {s.y}
							spec={s.spec}
							selected={s.selected} 
							key={k}
							ref={"symbol" + k}/>;

				symbols.push(c);
				
				// Add symbol to bounding box of selection if necessary

				if (s.selected) {
					selectedCount++;
					var sb = Symbol.getBounds(c.props);
					if (!bounds) { 
						bounds = {left: sb.left, top: sb.top, right: sb.left + sb.width, bottom: sb.top + sb.height};
					} else {
						bounds.left = Math.min(sb.left, bounds.left);
						bounds.top = Math.min(sb.top, bounds.top);
						bounds.right = Math.max(sb.left + sb.width, bounds.right);
						bounds.bottom = Math.max(sb.top + sb.height, bounds.bottom);
					}
				}
			}

			if (bounds) {
				bounds.width = bounds.right - bounds.left;
				bounds.height = bounds.bottom - bounds.top;
				
				var selectionBox = <SelectionBox 
										left={bounds.left} 
										top={bounds.top} 
										width={bounds.width} 
										height={bounds.height} 
										onMove={this.selection_Move}
										onMoveEnd={this.selection_MoveEnd}
										onDelete={this.selection_Delete}
										onStartResize={this.selection_StartResize}
										onResize={this.selection_Resize}
										allowResize={selectedCount == 1} />
			}


			return (
				<div className="equation-canvas" 
					onMouseDown={this.canvas_MouseDown}
					onMouseUp={this.canvas_MouseUp}
					onTouchStart={this.canvas_TouchStart}
					onTouchEnd={this.canvas_TouchEnd}>
					{symbols}
					{inputBox}
					{lasso}
					{selectionBox}
				</div>
			);
		}
	});

	var SymbolMenu = React.createClass({

		getDefaultProps: function() {
			return {
				btnSize: 80,
				orientation: "vertical",
				symbolSpecs: [],
			};
		},

		getInitialState: function() {
			return {
				draggingButtonIndex: null,
				scroll: 0,
			};
		},

		button_Grab: function(i) {

			this.setState({
				grabScroll: this.state.scroll,
			})
		},

		button_Drag: function(i, totalDx, totalDy, dx, dy, e) {

			var vertical = this.props.orientation == "vertical";
			var d = vertical ? totalDy : totalDx;
			var perpendicularD = vertical ? totalDx : totalDy;

			var viewportLength = vertical ? $(this.getDOMNode()).height() : $(this.getDOMNode()).width();
			var listLength = vertical ? $(this.refs.list.getDOMNode()).height() : $(this.refs.list.getDOMNode()).width();

			var overflowAvailable = Math.max(0, listLength - viewportLength - this.state.grabScroll);
			var underflowAvailable = Math.max(0, this.state.grabScroll);

			var scrolling = Math.abs(perpendicularD) < this.props.btnSize;
			if (scrolling) {
				var newScroll = this.state.grabScroll - (d < 0 ? -Math.min(-d, overflowAvailable) : Math.min(d, underflowAvailable));
			} else {
				var newScroll = this.state.grabScroll;
			}

			var symbol = this.props.symbolSpecs[i];
			var si = i;

			if(symbol.subMenu)
				si = null;

			this.setState({
				draggingButtonIndex: si,
				dragDx: totalDx,
				dragDy: totalDy,
				scroll: newScroll,
				scrolling: scrolling
			});
		},

		button_Drop: function(i, pageX, pageY, totalDx, totalDy, localX, localY, e) {

			if (this.state.draggingButtonIndex == null)
				return; // We picked up a subMenu button.

			$(this.refs["button" + i].getDOMNode()).fadeTo(200,1);

			var s = this.refs.grabbedSymbol;

			var offset = $(this.getDOMNode()).offset();
			this.setState({draggingButtonIndex: null});

			this.props.onSpawnSymbol(offset.left + s.props.x, offset.top + s.props.y, clone(s.props.spec));


		},

		button_Click: function(i) {
			var symbol = this.props.symbolSpecs[i];

			if (symbol.subMenu) {
				this.setState({
					subMenu: i,
				})
			}
		},

		subMenu_Cancel: function() {
			this.setState({
				subMenu: undefined,
			})
		},

		subMenu_SpawnSymbol: function(x,y,spec) {

			if (!this.refs.subMenu.refs.menu.state.scrolling) {
				this.props.onSpawnSymbol(x, y, clone(spec));
				this.setState({
					subMenu: undefined,
				})
			}
		},

		componentDidMount: function() {
			this.handlers = [];
			for (var i = 0; i < this.props.symbolSpecs.length; i++) {
				this.handlers.push(new InteractionHandler(this.refs["button" + i].getDOMNode(), this.button_Grab.bind(this, i), this.button_Drag.bind(this, i), this.button_Drop.bind(this, i), this.button_Click.bind(this, i)));
			}
			
		},

		componentWillUnmount: function() {
			for(var i in this.handlers)
				this.handlers[i].removeHandlers();
		},

		render: function() {

			var symbols = [];

			var btnWidth = this.props.orientation == "vertical" ? this.props.width : this.props.btnSize;
			var btnHeight = this.props.orientation == "vertical" ? this.props.btnSize : this.props.height;

			for (var i = 0; i < this.props.symbolSpecs.length; i++) {
				
				var symbolSpec = this.props.symbolSpecs[i];

				var x = btnWidth / 2;
				var y = btnHeight / 2;

				var liStyle = {};

				if (this.props.orientation == "vertical")
					liStyle.height = this.props.btnSize;
				else
					liStyle.width = this.props.btnSize;


				if(this.state.draggingButtonIndex == i) {
					liStyle.opacity = 0.1;
				}

				var symbol = (
					<li className="symbol-button vertical" style={liStyle} ref={"button" + i} key={i}>
						<Symbol 
							x={x}
							y={y}
							key={"s" + i}
							spec={symbolSpec} 
							ref={"symbol" + i }/>
					</li>
				);

				symbols.push(symbol);
			}

			var style = {};
			if (this.props.orientation == "vertical") {
				style.top = -this.state.scroll;
			} else {
				style.left = - this.state.scroll;
				style.width = this.props.symbolSpecs.length * this.props.btnSize;
			}

			if (this.state.draggingButtonIndex != null) {
				var i = this.state.draggingButtonIndex;
				var gx = this.props.btnSize / 2 + this.state.dragDx;
				var gy = this.props.btnSize / 2 + this.state.dragDy;

				if (this.props.orientation == "vertical")
					gy += i*this.props.btnSize - this.state.grabScroll;
				else
					gx += i*this.props.btnSize - this.state.grabScroll;

				var grabbedSymbol = <Symbol 
										x={gx}
										y={gy}
										key="grabbedSymbol"
										ref="grabbedSymbol"
										spec={this.props.symbolSpecs[this.state.draggingButtonIndex]}/>

			}

			if (this.state.subMenu != null) {

				var subMenu = <SubMenu ref="subMenu" symbolSpecs={this.props.symbolSpecs[this.state.subMenu].subMenu} onCancel={this.subMenu_Cancel} onSpawnSymbol={this.subMenu_SpawnSymbol}/>
				

			}

			return (
				<div className={"symbol-menu " + this.props.orientation} style={{
						left: this.props.left,
						top: this.props.top,
						right: this.props.right,
						bottom: this.props.bottom,
						width: this.props.width,
						height: this.props.height,}}>
					<div className="list-container" >
						<ul ref="list" style={style} className={(this.state.scrolling ? "scrolling" : "")}>
							{symbols}
						</ul>
					</div>
					{subMenu}
					{grabbedSymbol}
				</div>
			);
		}
	});

	var SubMenu = React.createClass({

		componentDidMount: function() {
			this.backgroundHandler = new InteractionHandler(this.refs.background.getDOMNode(), this.cancel);
		},

		componentWillUnmount: function() {
			this.backgroundHandler.removeHandlers();
		},

		cancel: function() {
			this.props.onCancel();
		},

		render: function() {
			return (
				<div className="submenu" style={{right: "100%"}}>
					<div className="submenu-background" ref="background" />
					<SymbolMenu ref="menu" right={0} width={120} top={0} bottom={0} btnSize={120} symbolSpecs={this.props.symbolSpecs} onSpawnSymbol={this.props.onSpawnSymbol}/>
				</div>
			);
		}
	});

	var Editor = React.createClass({

		symbol_Spawn: function(x, y, spec) {
			var c = $(this.refs.canvas.getDOMNode());
			var offset = c.offset();
			var targetX = x - offset.left;
			var targetY = y - offset.top;

			if (targetX > 0 && targetY > 0 && targetX < c.width() && targetY < c.height()) {
				this.refs.canvas.addSymbol(targetX, targetY , spec);
				return true;
			} else {
				return false;
			}
		},

		render: function() {
			

			var leftMenuSymbolSpecs = generateStringSymbolSpecs(["+", "–", "/", "="]);
			leftMenuSymbolSpecs.push({
				type: "container",
				width: 48,
				height: 36,
				subType: "sqrt",
			});

			rightMenuSymbolSpecs = generateStringSymbolSpecs(["α", "x", "y", "z", "m", "g"])
			rightMenuSymbolSpecs[0].subMenu = generateStringSymbolSpecs(["α", "ϐ", "ϑ", "ϕ", "ϡ", "ϥ"])


			var topMenuSymbolSpecs = generateStringSymbolSpecs(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]);

			return (
				<div className="equation-editor">
					<CanvasComponent ref="canvas"/>
					<SymbolMenu left={0} top={120} bottom={0} width={120} btnSize={120} symbolSpecs={leftMenuSymbolSpecs} onSpawnSymbol={this.symbol_Spawn}/>
					<SymbolMenu right={0} top={120} bottom={0} width={120} btnSize={120} symbolSpecs={rightMenuSymbolSpecs} onSpawnSymbol={this.symbol_Spawn} />
					<SymbolMenu left={0} right={0} top={0} height={120} btnSize={120} symbolSpecs={topMenuSymbolSpecs} onSpawnSymbol={this.symbol_Spawn} orientation="horizontal"/>
				</div>
			);
		}
	});

	return EquationEditor;
});