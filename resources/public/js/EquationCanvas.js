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

	    //return {left: 20, top: 20, width: 100, height: 100};
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

	var Symbol = React.createClass({

		hitRegion_Grab: function(pageX, pageY) {
			var offset = $(this.getDOMNode()).offset();
			var x = pageX - offset.left
			var y = pageY - offset.top

			return this.props.onGrab(x, y, this.props.key);
		},

		hitRegion_MouseDown: function(e) {
			return this.hitRegion_Grab(e.pageX, e.pageY);
		},

		hitRegion_TouchStart: function(e) {

			if (e.touches.length == 1) { // Only process the first touch to appear. No multi-touch nonsense here.

				return this.hitRegion_Grab(e.touches[0].pageX, e.touches[0].pageY);				
			}
		},

		render: function() {

			// Select which font to use, depending on the first character of the token.
			// Once we've chosen, resize the dummy mathjax to our required size, then ask for the font spec.

	    	var font = getFontForToken(this.props.token, this.props.fontSize);

		    // Get the left,top,width,height of the actual rendered character.

    		var bounds = measureText(this.props.token, font, this.props.fontSize, this.props.fontSize * 2);

			return (
				<div className={"symbol" + (this.props.selected ? " selected" : "")} 
					style={{
						width: bounds.width,
						height: bounds.height,
						left: this.props.x - bounds.width / 2,
						top: this.props.y - bounds.height / 2,
						font: font,
						fontSize: this.props.fontSize,
					}}>

					<div className="symbol-content" 
						style={{
							left: -bounds.left,
							top: -bounds.top,
						}}>

						{this.props.token}

					</div>
					<div className="selection-outline" style={{display: this.props.selected ? "block" : "none" }}/>
					<div className="symbol-hit-region"
						onMouseDown={this.hitRegion_MouseDown} 
						onTouchStart={this.hitRegion_TouchStart} />
				</div>
			);
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
					break;
				case 27:
					this.props.onCancel();
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

		createSymbol: function(x, y, fontSize, token) {
			return <Symbol onGrab={this.symbol_Grab}
						   selected={false} 
						   token={token} 
						   x={x}
						   y={y} 
						   fontSize={fontSize} 
						   key={getNextSymbolKey()}/>;
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

			var newSym = this.createSymbol(x,y,fontSize,token);
			this.state.symbols[newSym.props.key] = newSym;
			this.forceUpdate();

			this.setState({
				inputBox: null,
			});
		},

		selection_commit: function(bounds) {

			for (var i in this.state.symbols) {
				var s = this.state.symbols[i];

				s.props.selected = (s.props.x > bounds.left && s.props.x < bounds.left + bounds.width &&
									s.props.y > bounds.top && s.props.y < bounds.top + bounds.height);
			}

			this.forceUpdate();

			this.setState({selectionBox: null});
		},

		injectSymbol: function(x, y, fontSize, token) {

			var newSym = this.createSymbol(x,y,fontSize,token);
			this.state.symbols[newSym.props.key] = newSym;

			this.forceUpdate();

			return newSym.props.key; // key of new symbol
		},

		canvas_Click: function(x,y,button, target) {

			var deselected = this.deselectSymbols();

			if (!deselected) {

				var fontSize = parseFloat($(this.getDOMNode()).css("font-size"));

				var inputBox = <InputBox x={x} y={y} fontSize={fontSize} onCommit={this.input_commit} onCancel={this.input_cancel} key="THING"/>;

				this.setState({inputBox: inputBox});
			}
		},

		canvas_Press: function(x,y, button, target) {
			if(button === 0 || button == undefined) {
				this.setState({
					selectionBox: <SelectionBox originX={x} originY={y} onCommit={this.selection_commit} />
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
			console.log("CMU");
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

		deselectSymbols: function() {

			var deselected = 0;

			for(var i in this.state.symbols) {
				var sym = this.state.symbols[i];
				if (sym.props.selected) {
					deselected++;
					sym.props.selected = false;
				}
			}

			this.forceUpdate();

			return deselected;
		},

		getSelectedSymbols: function() {
			var selected = [];

			for(var i in this.state.symbols)
				if (this.state.symbols[i].props.selected)
					selected.push(this.state.symbols[i]);

			return selected;
		},

		symbol_Click: function(x,y,s) {

			this.deselectSymbols();
			s.props.selected = true;

			this.forceUpdate();
		},

		symbol_Grab: function(x, y, k) {

			// If this symbol is not already selected, deselect all others.

			if(!this.state.symbols[k].props.selected)
				this.deselectSymbols();

			// If we're currently displaying the input box, remove it.
			if (this.state.inputBox)
				this.state.inputBox.commit();

			// If nothing is selected, select this symbol.

			var selectedSymbols = this.getSelectedSymbols();

			if (selectedSymbols.length == 0)
				selectedSymbols = [this.state.symbols[k]]

			// Record where these symbols were when we started dragging.

			for (var j in selectedSymbols) {
				var s = selectedSymbols[j];

				s.props.dragStartX = s.props.x;
				s.props.dragStartY = s.props.y;
			}

			// Record that we are dragging, and where the mouse was when we started.

			this.setState({
				draggingSymbols: selectedSymbols,
				symbolGrabX: x,
				symbolGrabY: y,
				grabbedSymbol: this.state.symbols[k],
			});

			// Do not bubble this event - we've dealt with it.

			return false;
		},

		componentDidMount: function() {

			// Disable text selection as much as we can, so that we can drag things around.
			$(this.getDOMNode()).on("selectstart", function() { return false;})
			$(this.getDOMNode()).parents().on("selectstart", function() { return false;})
		},

		componentWillUpdate: function(nextProps, nextState) {

			// Deal with drag start

			if (this.state.draggingSymbols == null && nextState.draggingSymbols != null) {
				// We have just picked up a symbol. Attach appropriate event handlers for dragging.

				console.log("Start drag:", nextState.draggingSymbols);

				window.addEventListener("mousemove", this.window_MouseMove);
				window.addEventListener("mouseup", this.window_MouseUp);
				window.addEventListener("touchmove", this.window_TouchMove);
				window.addEventListener("touchend", this.window_TouchEnd);
			}

			// Deal with drag end

			if (this.state.draggingSymbols != null && nextState.draggingSymbols == null) {

				console.log("End drag:", this.state.draggingSymbols);

				window.removeEventListener("mousemove", this.window_MouseMove);
				window.removeEventListener("mouseup", this.window_MouseUp);
				window.removeEventListener("touchmove", this.window_TouchMove);
				window.removeEventListener("touchend", this.window_TouchEnd);
			}
		},

		window_DragMove: function(dx, dy) {
			for(var i in this.state.draggingSymbols) {
				var s = this.state.draggingSymbols[i];

				s.props.x = s.props.dragStartX + dx;
				s.props.y = s.props.dragStartY + dy;
			}

			this.forceUpdate();
		},

		window_Drop: function(dx, dy) {

			// Delete any symbols now outside the canvas. We have to do this every time, because we might not have dragged a newly created symbol from the menu.

			var width = $(this.getDOMNode()).width();
			var height = $(this.getDOMNode()).height();

			for(var i = 0; i < this.state.draggingSymbols.length; i++) {
				var sym = this.state.draggingSymbols[i];
				if (sym.props.x < 0 || sym.props.y < 0 || sym.props.x > width || sym.props.y > height) {
					delete this.state.symbols[sym.props.key];
				}
			}

			this.forceUpdate();

			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { // Change this to allow less precise clicks
				this.symbol_Click(this.state.symbolGrabX, this.state.symbolGrabY, this.state.grabbedSymbol);
			}

			this.setState({
				draggingSymbols: null,
				grabbedSymbol: null,
			});


		},

		window_MouseMove: function(e) {
			var symbol = $(this.state.grabbedSymbol.getDOMNode());
			var canvas = $(this.getDOMNode());

			var dx = e.pageX - (canvas.offset().left + this.state.grabbedSymbol.props.dragStartX - symbol.width() / 2 + this.state.symbolGrabX);
			var dy = e.pageY - (canvas.offset().top + this.state.grabbedSymbol.props.dragStartY - symbol.height() / 2 + this.state.symbolGrabY);
			
			this.window_DragMove(dx, dy);
		},

		window_MouseUp: function(e) {
			var symbol = $(this.state.grabbedSymbol.getDOMNode());
			var canvas = $(this.getDOMNode());

			var dx = e.pageX - (canvas.offset().left + this.state.grabbedSymbol.props.dragStartX - symbol.width() / 2 + this.state.symbolGrabX);
			var dy = e.pageY - (canvas.offset().top + this.state.grabbedSymbol.props.dragStartY - symbol.height() / 2 + this.state.symbolGrabY);

			this.window_Drop(dx, dy);
		},

		window_TouchMove: function(e) {
			if (e.touches.length == 1) {
				var symbol = $(this.state.grabbedSymbol.getDOMNode());
				var canvas = $(this.getDOMNode());

				var dx = e.changedTouches[0].pageX - (canvas.offset().left + this.state.grabbedSymbol.props.dragStartX - symbol.width() / 2 + this.state.symbolGrabX);
				var dy = e.changedTouches[0].pageY - (canvas.offset().top + this.state.grabbedSymbol.props.dragStartY - symbol.height() / 2 + this.state.symbolGrabY);
				this.window_DragMove(dx, dy);
			}
			e.preventDefault();
			return false;
		},

		window_TouchEnd: function(e) {
			if (e.changedTouches.length == 1) {

				var symbol = $(this.state.grabbedSymbol.getDOMNode());
				var canvas = $(this.getDOMNode());

				var dx = e.changedTouches[0].pageX - (canvas.offset().left + this.state.grabbedSymbol.props.dragStartX - symbol.width() / 2 + this.state.symbolGrabX);
				var dy = e.changedTouches[0].pageY - (canvas.offset().top + this.state.grabbedSymbol.props.dragStartY - symbol.height() / 2 + this.state.symbolGrabY);

				this.window_Drop(dx, dy);

			}
		},

		render: function() {
			return (
				<div className="equation-canvas" 
					onMouseDown={this.canvas_MouseDown}
					onMouseUp={this.canvas_MouseUp}
					onTouchStart={this.canvas_TouchStart}
					onTouchEnd={this.canvas_TouchEnd}>
					{this.state.symbols}
					{this.state.inputBox}
					{this.state.selectionBox}
				</div>
			);
		}
	});

	var SymbolMenu = React.createClass({

		getDefaultProps: function() {
			return {
				btnSize: 50,
				orientation: "vertical",
				tokens: [],
			};
		},

		spawnSymbol: function(grabX, grabY, i) {

			var src = this.refs["symbol" + i];
			var srcBtn = this.refs["button" + i];

			var offset = $(srcBtn.getDOMNode()).offset();

			this.props.onSpawnSymbol(offset.left + src.props.x, offset.top + src.props.y, src.props.fontSize, src.props.token, grabX, grabY);

			$(src.getDOMNode()).hide().fadeIn(1000);
		},

		render: function() {

			var symbols = [];

			var btnWidth = this.props.orientation == "vertical" ? this.props.width : this.props.btnSize;
			var btnHeight = this.props.orientation == "vertical" ? this.props.btnSize : this.props.height;

			for (var i = 0; i < this.props.tokens.length; i++) {
				
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

					var symbol = (
						<li className="symbol-button" onMouseDown={spawnMouse} onTouchStart={spawnTouch} ref={"button" + i} key={i} style={{
							left: this.props.orientation == "vertical" ? 0 : this.props.btnSize * i,
							top: this.props.orientation == "vertical" ? this.props.btnSize * i : 0,
							width: btnWidth,
							height: btnHeight,

						}}>
							<Symbol x={btnWidth/2} y={btnHeight/2} fontSize={this.props.btnSize*0.7} token={this.props.tokens[i]} onGrab={nop} key={i} ref={"symbol" + i }/>
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

		menu_SpawnSymbol: function(pageX, pageY, fontSize, token, grabX, grabY) {

			var canvasOffset = $(this.refs.canvas.getDOMNode()).offset();
			var newSymbolKey = this.refs.canvas.injectSymbol(pageX - canvasOffset.left, pageY - canvasOffset.top, fontSize, token);
			this.refs.canvas.symbol_Grab(grabX, grabY, newSymbolKey);
		},

		render: function() {
			

			return (
				<div className="equation-editor">
					<CanvasComponent ref="canvas"/>
					<SymbolMenu left={0} top={80} width={80} btnSize={80} tokens={["+", "–", "="]} className="thing" onSpawnSymbol={this.menu_SpawnSymbol} />
					<SymbolMenu right={0} top={80} width={80} btnSize={80} tokens={["x", "y", "z"]} className="thing" onSpawnSymbol={this.menu_SpawnSymbol} />
				</div>
			);
		}
	});

	return EquationEditor;
});