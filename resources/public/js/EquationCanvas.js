define(function(require) {
	
	var $ = require("jquery");

	var React = require("react");

	React.initializeTouchEvents(true);
	require("rsvp");

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

	var Deletable = {
		deleteHandle_Click: function(e) {

			e.preventDefault();
			e.stopPropagation();
		},

		deleteHandle_Press: function(e) {

			this.refs.deleteHandle.getDOMNode().addEventListener("mouseup", this.deleteHandle_MouseUp);
			this.refs.deleteHandle.getDOMNode().addEventListener("touchend", this.deleteHandle_TouchEnd);

			e.preventDefault();
			e.stopPropagation();
		},

		deleteHandle_Release: function(pageX, pageY, e) {

			this.refs.deleteHandle.getDOMNode().removeEventListener("mouseup", this.deleteHandle_MouseUp);
			this.refs.deleteHandle.getDOMNode().removeEventListener("touchend", this.deleteHandle_TouchEnd);

			var n = $(this.refs.deleteHandle.getDOMNode());
			var offset = n.offset();

			if(pageX > offset.left && pageY > offset.top && pageX < n.width() + offset.left && pageY < n.height() + offset.top) 
				this.props.onDelete(this.props.key);

			e.preventDefault();
			e.stopPropagation();			
		},

		componentDidMount: function() {
			this.refs.deleteHandle.getDOMNode().addEventListener("mousedown", this.deleteHandle_MouseDown);
			this.refs.deleteHandle.getDOMNode().addEventListener("touchstart", this.deleteHandle_TouchStart);
		},

		componentWillUnmount: function() {
			this.refs.deleteHandle.getDOMNode().removeEventListener("mousedown", this.deleteHandle_MouseDown);
			this.refs.deleteHandle.getDOMNode().removeEventListener("touchstart", this.deleteHandle_TouchStart);
		},

		deleteHandle_MouseDown: function(e) {
			this.deleteHandle_Press(e);
		},

		deleteHandle_TouchStart: function(e) {
			this.deleteHandle_Press(e);
		},

		deleteHandle_MouseUp: function(e) {
			this.deleteHandle_Release(e.pageX, e.pageY, e);
		},

		deleteHandle_TouchEnd: function(e) {
			if(e.changedTouches.length == 1)
				this.deleteHandle_Release(e.changedTouches[0].pageX, e.changedTouches[0].pageY, e);
		},
	};

	var Movable = {
		moveHandle_Grab: function(pageX, pageY, e) {
			var offset = $(this.getDOMNode()).offset();
			var x = pageX - offset.left
			var y = pageY - offset.top


			this.props.onGrab(x,y,this.props.key,e)
		},


		moveHandle_MouseDown: function(e) {
			this.moveHandle_Grab(e.pageX, e.pageY, e);
		},

		moveHandle_TouchStart: function(e) {
			if(e.touches.length == 1) 
				this.moveHandle_Grab(e.touches[0].pageX, e.touches[0].pageY, e);
		},

		componentDidMount: function() {
			if (this.refs) {
				if (this.refs.moveHandle) {
					this.refs.moveHandle.getDOMNode().addEventListener("mousedown", this.moveHandle_MouseDown);
					this.refs.moveHandle.getDOMNode().addEventListener("touchstart", this.moveHandle_TouchStart);
				}
				if (this.refs.grabRegion) {
					this.refs.grabRegion.getDOMNode().addEventListener("mousedown", this.moveHandle_MouseDown);
					this.refs.grabRegion.getDOMNode().addEventListener("touchstart", this.moveHandle_TouchStart);
				}
			}
		},

		componentWillUnmount: function() {
			if (this.refs) {
				if (this.refs.moveHandle) {
					this.refs.moveHandle.getDOMNode().removeEventListener("mousedown", this.moveHandle_MouseDown);
					this.refs.moveHandle.getDOMNode().removeEventListener("touchstart", this.moveHandle_TouchStart);
				}
				if (this.refs.grabRegion) {
					this.refs.grabRegion.getDOMNode().removeEventListener("mousedown", this.moveHandle_MouseDown);
					this.refs.grabRegion.getDOMNode().removeEventListener("touchstart", this.moveHandle_TouchStart);
				}
			}
		},
	};

	var Resizable = {
		resizeHandle_Grab: function(pageX, pageY, e) {
			console.log("Resize Handle Grab");

			this.setState({resizeHandleGrabX: pageX, resizeHandleGrabY: pageY});

			this.startResize();

			window.addEventListener("mousemove", this.window_ResizeHandleMouseMove);
			window.addEventListener("mouseup", this.window_ResizeHandleMouseUp);
			window.addEventListener("touchmove", this.window_ResizeHandleTouchMove);
			window.addEventListener("touchend", this.window_ResizeHandleTouchEnd);

			e.preventDefault();
			e.stopPropagation();
		},

		window_ResizeHandleDragMove: function(pageX, pageY, e) {

			var dx = pageX - this.state.resizeHandleGrabX;
			var dy = pageY - this.state.resizeHandleGrabY;

			//console.log("Resize Handle Drag", dx, dy);

			this.resize(dx, dy);
			e.preventDefault();
			e.stopPropagation();
		},

		window_ResizeHandleDrop: function(pageX, pageY, e) {
			console.log("Resize Handle Drop");

			window.removeEventListener("mousemove", this.window_ResizeHandleMouseMove);
			window.removeEventListener("mouseup", this.window_ResizeHandleMouseUp);
			window.removeEventListener("touchmove", this.window_ResizeHandleTouchMove);
			window.removeEventListener("touchend", this.window_ResizeHandleTouchEnd);

			e.preventDefault();
			e.stopPropagation();
		},

		resizeHandle_MouseDown: function(e) {
			this.resizeHandle_Grab(e.pageX, e.pageY, e);
		},

		resizeHandle_TouchStart: function(e) {
			if(e.touches.length == 1) 
				this.resizeHandle_Grab(e.touches[0].pageX, e.touches[0].pageY, e);
		},

		componentDidMount: function() {
			if (this.refs && this.refs.resizeHandle) {
				this.refs.resizeHandle.getDOMNode().addEventListener("mousedown", this.resizeHandle_MouseDown);
				this.refs.resizeHandle.getDOMNode().addEventListener("touchstart", this.resizeHandle_TouchStart);
			}
		},

		componentWillUnmount: function() {
			if (this.refs && this.refs.resizeHandle) {
				this.refs.resizeHandle.getDOMNode().removeEventListener("mousedown", this.resizeHandle_MouseDown);
				this.refs.resizeHandle.getDOMNode().removeEventListener("touchstart", this.resizeHandle_TouchStart);
			}
		},

		window_ResizeHandleMouseMove: function(e) {
			this.window_ResizeHandleDragMove(e.pageX, e.pageY, e);
		},

		window_ResizeHandleMouseUp: function(e) {
			this.window_ResizeHandleDrop(e.pageX, e.pageY, e);
		},

		window_ResizeHandleTouchMove: function(e) {
			if (e.touches.length == 1)
				this.window_ResizeHandleDragMove(e.touches[0].pageX, e.touches[0].pageY, e);
		},

		window_ResizeHandleTouchEnd: function(e) {
			if (e.changedTouches.length == 1) 
				this.window_ResizeHandleDrop(e.changedTouches[0].pageX, e.changedTouches[0].pageY, e);
		},
	};

	var ResizableBox =  {

		mixins: [Resizable],

		startResize: function() {
			this.setState({
				resizeGrabWidth: this.props.spec.width, 
				resizeGrabHeight: this.props.spec.height, 
				resizeGrabX: this.props.x, 
				resizeGrabY: this.props.y
			});
		},

		resize: function(dx, dy) {

			dx = Math.max(dx, 5-this.state.resizeGrabWidth);
			dy = Math.max(dy, 5-this.state.resizeGrabHeight);

			var newWidth = this.state.resizeGrabWidth + dx;
			var newHeight = this.state.resizeGrabHeight + dy;


			this.props.onPositionChange(this.state.resizeGrabX + dx / 2, this.state.resizeGrabY + dy / 2, this.props.key);

			this.props.spec.width = newWidth;
			this.props.spec.height = newHeight;

			this.props.onSpecChange(this.props.spec, this.props.key);
		},
	};

	var TextSymbol = React.createClass({

		mixins: [Resizable, Movable, Deletable],

		startResize: function() {
			this.setState({
				resizeGrabFontSize: this.props.spec.fontSize,
			})
		},

		resize: function(dx, dy) {
			this.props.spec.fontSize = this.state.resizeGrabFontSize + Math.max(dx, dy) * 4;

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

		mixins: [ResizableBox, Movable, Deletable],


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
				symbols: {},
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

		symbol_Click: function(x,y,k) {

			this.deselectSymbols();
			this.state.symbols[k].selected = true;

			this.forceUpdate();
		},

		symbol_Grab: function(x, y, k, e) {
			// If this symbol is not already selected, deselect all others.

			if(!this.state.symbols[k].selected)
				this.deselectSymbols();

			// If we're currently displaying the input box, remove it.
			if (this.state.inputBox)
				this.refs.inputBox.commit();

			// If nothing is selected, select this symbol.

			var symbolKeysToDrag = this.getSelectedSymbolKeys();

			if (symbolKeysToDrag.length == 0)
				symbolKeysToDrag = [k]

			// Record where these symbols were when we started dragging.

			for (var j in symbolKeysToDrag) {
				var s = this.state.symbols[symbolKeysToDrag[j]];

				s.dragStartX = s.x;
				s.dragStartY = s.y;
			}

			// Record that we are dragging, and where the mouse was when we started.

			this.setState({
				draggingSymbolKeys: symbolKeysToDrag,
				symbolGrabX: x,
				symbolGrabY: y,
				grabbedSymbolKey: k,
			});

			// Do not bubble this event - we've dealt with it.
			if (e) {
				e.preventDefault();
				e.stopPropagation();
			}
		},

		symbol_SpecChange: function(newSpec, k) {

			for(var a in newSpec)
				this.state.symbols[k][a] = newSpec[a];

			this.forceUpdate();
		},

		symbol_PositionChange: function(newX, newY, k) {
			this.state.symbols[k].x = newX;
			this.state.symbols[k].y = newY;

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
		},

		componentWillUpdate: function(nextProps, nextState) {

			// Deal with drag start

			if (this.state.draggingSymbolKeys == null && nextState.draggingSymbolKeys != null) {
				// We have just picked up a symbol. Attach appropriate event handlers for dragging.

				console.log("Start drag:", nextState.draggingSymbolKeys);

				window.addEventListener("mousemove", this.window_MouseMove);
				window.addEventListener("mouseup", this.window_MouseUp);
				window.addEventListener("touchmove", this.window_TouchMove);
				window.addEventListener("touchend", this.window_TouchEnd);
			}

			// Deal with drag end

			if (this.state.draggingSymbolKeys != null && nextState.draggingSymbolKeys == null) {

				console.log("End drag:", this.state.draggingSymbolKeys);

				window.removeEventListener("mousemove", this.window_MouseMove);
				window.removeEventListener("mouseup", this.window_MouseUp);
				window.removeEventListener("touchmove", this.window_TouchMove);
				window.removeEventListener("touchend", this.window_TouchEnd);
			}
		},

/////////////////////
// INTERACTION THINGS
/////////////////////

		canvas_Click: function(x,y,button, target) {

			var deselected = this.deselectSymbols();

			if (deselected == 0) {

				var fontSize = parseFloat($(this.getDOMNode()).css("font-size"));

				var inputBox = {x: x, y: y, fontSize: fontSize};

				this.setState({inputBox: inputBox});					

			}
		},

		canvas_Press: function(x,y, button, target) {
			if(button === 0 || button == undefined) {
				this.setState({
					selectionBox: {originX: x, originY: y}
				});
			}

			this.setState({
				mouseDownX: x,
				mouseDownY: y,
			})
		},

		canvas_Release: function(x,y, button, target) {
			if(this.state.mouseDownX && Math.abs(this.state.mouseDownX - x) < 1 &&
			   this.state.mouseDownY && Math.abs(this.state.mouseDownY - y) < 1) {

				this.canvas_Click(x,y, button, target);
			}
		},

		canvas_MouseDown: function(e) {

			var offset = $(this.getDOMNode()).offset();
			var x = e.pageX - offset.left;
			var y = e.pageY - offset.top;

			this.canvas_Press(x, y, e.button, e.target);
		},

		canvas_MouseUp: function(e) {

			var offset = $(this.getDOMNode()).offset();
			var x = e.pageX - offset.left;
			var y = e.pageY - offset.top;

			this.canvas_Release(x, y, e.button, e.target);
		},

		canvas_TouchStart: function(e) {
			if (e.touches.length == 1) {

				var offset = $(this.getDOMNode()).offset();
				var x = e.touches[0].pageX - offset.left;
				var y = e.touches[0].pageY - offset.top;

				// Need this because touch events don't always cause inputbox to blur.
				if(this.state.inputBox)
					this.refs.inputBox.commit();

				this.canvas_Press(x, y, 0, e.target);
			}
		},

		canvas_TouchEnd: function(e) {

			if (e.changedTouches.length == 1) {
				var offset = $(this.getDOMNode()).offset();
				var x = e.changedTouches[0].pageX - offset.left;
				var y = e.changedTouches[0].pageY - offset.top;

				this.canvas_Release(x, y, 0, e.target);
			}
		},

		window_DragMove: function(dx, dy) {
			for(var i in this.state.draggingSymbolKeys) {
				var s = this.state.symbols[this.state.draggingSymbolKeys[i]];

				s.x = s.dragStartX + dx;
				s.y = s.dragStartY + dy;
			}

			this.forceUpdate();
		},

		window_Drop: function(dx, dy) {

			// Delete any symbols now outside the canvas. We have to do this every time, because we might not have dragged a newly created symbol from the menu.

			var width = $(this.getDOMNode()).width();
			var height = $(this.getDOMNode()).height();

			var deletedDroppedSymbol = false;

			for(var i = 0; i < this.state.draggingSymbolKeys.length; i++) {
				var k = this.state.draggingSymbolKeys[i]
				var sym = this.state.symbols[k];
				if (sym.x < 0 || sym.y < 0 || sym.x > width || sym.y > height) {
					delete this.state.symbols[k];
					if (k == this.state.grabbedSymbolKey)
						deletedDroppedSymbol = true;
				}
			}

			this.forceUpdate();

			if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !deletedDroppedSymbol) { // Change this to allow less precise clicks
				this.symbol_Click(this.state.symbolGrabX, this.state.symbolGrabY, this.state.grabbedSymbolKey);
			}

			this.setState({
				draggingSymbolKeys: null,
				grabbedSymbolKey: null,
			});


		},

		window_MouseMove: function(e) {
			var symbol = $(this.refs["symbol" + this.state.grabbedSymbolKey].getDOMNode());
			var canvas = $(this.getDOMNode());

			var dx = e.pageX - (canvas.offset().left + this.state.symbols[this.state.grabbedSymbolKey].dragStartX - symbol.width() / 2 + this.state.symbolGrabX);
			var dy = e.pageY - (canvas.offset().top + this.state.symbols[this.state.grabbedSymbolKey].dragStartY - symbol.height() / 2 + this.state.symbolGrabY);
			
			this.window_DragMove(dx, dy);
			e.preventDefault();
			return false;
		},

		window_MouseUp: function(e) {
			var symbol = $(this.refs["symbol" + this.state.grabbedSymbolKey].getDOMNode());
			var canvas = $(this.getDOMNode());

			var dx = e.pageX - (canvas.offset().left + this.state.symbols[this.state.grabbedSymbolKey].dragStartX - symbol.width() / 2 + this.state.symbolGrabX);
			var dy = e.pageY - (canvas.offset().top + this.state.symbols[this.state.grabbedSymbolKey].dragStartY - symbol.height() / 2 + this.state.symbolGrabY);

			this.window_Drop(dx, dy);
		},

		window_TouchMove: function(e) {
			if (e.touches.length == 1) {
				var symbol = $(this.refs["symbol" + this.state.grabbedSymbolKey].getDOMNode());
				var canvas = $(this.getDOMNode());

				var dx = e.changedTouches[0].pageX - (canvas.offset().left + this.state.symbols[this.state.grabbedSymbolKey].dragStartX - symbol.width() / 2 + this.state.symbolGrabX);
				var dy = e.changedTouches[0].pageY - (canvas.offset().top + this.state.symbols[this.state.grabbedSymbolKey].dragStartY - symbol.height() / 2 + this.state.symbolGrabY);
				this.window_DragMove(dx, dy);
			}
			e.preventDefault();
			return false;
		},

		window_TouchEnd: function(e) {
			if (e.changedTouches.length == 1) {

				var symbol = $(this.refs["symbol" + this.state.grabbedSymbolKey].getDOMNode());
				var canvas = $(this.getDOMNode());

				var dx = e.changedTouches[0].pageX - (canvas.offset().left + this.state.symbols[this.state.grabbedSymbolKey].dragStartX - symbol.width() / 2 + this.state.symbolGrabX);
				var dy = e.changedTouches[0].pageY - (canvas.offset().top + this.state.symbols[this.state.grabbedSymbolKey].dragStartY - symbol.height() / 2 + this.state.symbolGrabY);

				this.window_Drop(dx, dy);

			}
		},


		window_KeyDown: function(e) {
			switch(e.which){
				case 46:

				this.symbol_Delete();

				break;
			}
		},

/////////////////////////
// END INTERACTION THINGS
/////////////////////////

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
							onGrab={this.symbol_Grab} 
							onSpecChange={this.symbol_SpecChange}
							onPositionChange={this.symbol_PositionChange}
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
							<Symbol x={btnWidth/2} y={btnHeight/2} spec={symbolSpec} onGrab={nop} key={i} ref={"symbol" + i }/>
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
			this.refs.canvas.symbol_Grab(grabX, grabY, newSymbolKey);
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