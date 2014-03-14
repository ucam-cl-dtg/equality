define(function(require) {
	
	var $ = require("jquery");

	var React = require("react");

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

		onMouseDown: function(e) {
			return this.props.onMouseDown(e, this.props.key);
		},

		onMouseUp: function(e) {
			return this.props.onMouseUp(e, this.props.key);
		},

		onMouseMove: function(e) {
			return this.props.onMouseMove(e, this.props.key);
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
						onMouseDown={this.onMouseDown} 
						onMouseUp={this.onMouseUp} 
						onMouseMove={this.onMouseMove} />
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

		handleChange: function(e) {

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

		handleKeyUp: function(e) {
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
					onChange={this.handleChange}
					onKeyUp={this.handleKeyUp}
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

		handleMouseMove: function(e) {
			var offset = $(this.getDOMNode()).parent().offset();
			var x = e.pageX - offset.left
			var y = e.pageY - offset.top

			this.setState({
				width: x - this.props.originX,
				height: y - this.props.originY,
			})

		},

		handleMouseUp: function(e) {
			this.props.onCommit(this.getBounds());
		},

		componentDidMount: function() {
			window.addEventListener("mousemove", this.handleMouseMove);
			window.addEventListener("mouseup", this.handleMouseUp);
		},

		componentWillUnmount: function() {	
			window.removeEventListener("mousemove", this.handleMouseMove);
			window.removeEventListener("mouseup", this.handleMouseUp);
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
			return <Symbol onMouseDown={this.symbol_onMouseDown}
							     onMouseUp={this.symbol_onMouseUp}
							     onMouseMove={this.symbol_onMouseMove}
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

		canvas_onClick: function(e) {

			var offset = $(this.getDOMNode()).offset();
			var x = e.pageX - offset.left
			var y = e.pageY - offset.top


			if ($(e.target).parents(".symbol").length > 0)
				return;

			var deselected = this.deselectSymbols();

			if (!deselected) {

				var fontSize = parseFloat($(this.getDOMNode()).css("font-size"));

				var inputBox = <InputBox x={x} y={y} fontSize={fontSize} onCommit={this.input_commit} onCancel={this.input_cancel} key="THING"/>;

				this.setState({inputBox: inputBox});
			}
		},

		canvas_onMouseDown: function(e) {

			var offset = $(this.getDOMNode()).offset();
			var x = e.pageX - offset.left;
			var y = e.pageY - offset.top;

			if(e.button === 0) {
				this.setState({
					selectionBox: <SelectionBox originX={x} originY={y} onCommit={this.selection_commit} />
				});
			}

			this.setState({
				mouseDownX: x,
				mouseDownY: y,
			})
		},

		canvas_onMouseUp: function(e) {
			var offset = $(this.getDOMNode()).offset();
			var x = e.pageX - offset.left;
			var y = e.pageY - offset.top;

			if(this.state.mouseDownX && Math.abs(this.state.mouseDownX - x) < 1 &&
			   this.state.mouseDownY && Math.abs(this.state.mouseDownY - y) < 1) {

				this.canvas_onClick(e);

			}
		},

		canvas_onMouseMove: function(e) {

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

		symbol_onClick: function(e,s) {

			this.deselectSymbols();
			s.props.selected = true;

			this.forceUpdate();

			e.preventDefault();
			return false;
		},

		symbol_onMouseDown: function(e,k) {

			if(!this.state.symbols[k].props.selected)
				this.deselectSymbols();

			if (this.state.inputBox)
				this.state.inputBox.commit();

			var selectedSymbols = this.getSelectedSymbols();

			if (selectedSymbols.length == 0)
				selectedSymbols = [this.state.symbols[k]]

			for (var j in selectedSymbols) {
				var s = selectedSymbols[j];

				s.props.dragStartX = s.props.x;
				s.props.dragStartY = s.props.y;
			}

			this.setState({
				draggingSymbols: selectedSymbols,
				dragStartMouseX: e.screenX,
				dragStartMouseY: e.screenY,
				mouseDownSymbol: this.state.symbols[k],
			});

			e.preventDefault();
			return false;
		},

		symbol_onMouseUp: function(e,k) {

		},

		symbol_onMouseMove: function(e,k) {

		},

		componentDidMount: function() {
			$(this.getDOMNode()).on("selectstart", function() { return false;})
			$(this.getDOMNode()).parents().on("selectstart", function() { return false;})
		},

		componentWillUpdate: function(nextProps, nextState) {

			// Deal with drag start

			if (this.state.draggingSymbols == null && nextState.draggingSymbols != null) {
				// We have just picked up a symbol. Attach appropriate event handlers for dragging.

				console.log("Start drag:", nextState.draggingSymbols);

				window.addEventListener("mousemove", this.dragMouseMove);
				window.addEventListener("mouseup", this.dragMouseUp);
			}

			// Deal with drag end

			if (this.state.draggingSymbols != null && nextState.draggingSymbols == null) {

				console.log("End drag:", this.state.draggingSymbols);

				window.removeEventListener("mousemove", this.dragMouseMove);
				window.removeEventListener("mouseup", this.dragMouseUp);
			}
		},

		dragMouseMove: function(e) {

			var dx = e.screenX - this.state.dragStartMouseX;
			var dy = e.screenY - this.state.dragStartMouseY;

			for(var i in this.state.draggingSymbols) {
				var s = this.state.draggingSymbols[i];

				s.props.x = s.props.dragStartX + dx;
				s.props.y = s.props.dragStartY + dy;
			}

			this.forceUpdate();
		},

		dragMouseUp: function(e) {
			var dx = e.screenX - this.state.dragStartMouseX;
			var dy = e.screenY - this.state.dragStartMouseY;

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
				this.symbol_onClick(e, this.state.mouseDownSymbol);
			} 

			this.setState({
				draggingSymbols: null,
				mouseDownSymbol: null,
			});
		},

		render: function() {
			return (
				<div className="equation-canvas" 
					onClick={this.canvas_onClick}
					onMouseDown={this.canvas_onMouseDown}
					onMouseUp={this.canvas_onMouseUp}
					onMouseMove={this.canvas_onMouseMove}>
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

		spawnSymbol: function(e, i) {
			var src = this.refs["symbol" + i];
			var srcBtn = this.refs["button" + i];

			var offset = $(srcBtn.getDOMNode()).offset();

			this.props.onSpawnSymbol(offset.left + src.props.x, offset.top + src.props.y, src.props.fontSize, src.props.token, e);

			$(src.getDOMNode()).hide().fadeIn(1000);
		},

		render: function() {

			var symbols = [];

			var btnWidth = this.props.orientation == "vertical" ? this.props.width : this.props.btnSize;
			var btnHeight = this.props.orientation == "vertical" ? this.props.btnSize : this.props.height;

			for (var i = 0; i < this.props.tokens.length; i++) {
				
				(function(i) {

					var spawn = function(e) {

						this.spawnSymbol(e,i);

					}.bind(this);

					var symbol = (
						<li className="symbol-button" onMouseDown={spawn} ref={"button" + i} style={{
							left: this.props.orientation == "vertical" ? 0 : this.props.btnSize * i,
							top: this.props.orientation == "vertical" ? this.props.btnSize * i : 0,
							width: btnWidth,
							height: btnHeight,
						}}>
							<Symbol x={btnWidth/2} y={btnHeight/2} fontSize={this.props.btnSize*0.7} token={this.props.tokens[i]} onMouseMove={nop} onMouseDown={nop} onMouseUp={nop} key={i} ref={"symbol" + i }/>
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

		handleSpawnSymbol: function(pageX, pageY, fontSize, token, mouseDownEvent) {

			var canvasOffset = $(this.refs.canvas.getDOMNode()).offset();
			var newSymbolIndex = this.refs.canvas.injectSymbol(pageX - canvasOffset.left, pageY - canvasOffset.top, fontSize, token);
			this.refs.canvas.symbol_onMouseDown(mouseDownEvent, newSymbolIndex);
		},

		render: function() {
			

			return (
				<div className="equation-editor">
					<CanvasComponent ref="canvas"/>
					<SymbolMenu left={0} top={80} width={80} btnSize={80} tokens={["+", "–", "="]} className="thing" onSpawnSymbol={this.handleSpawnSymbol} />
					<SymbolMenu right={0} top={80} width={80} btnSize={80} tokens={["x", "y", "z"]} className="thing" onSpawnSymbol={this.handleSpawnSymbol} />
				</div>
			);
		}
	});

	return EquationEditor;
});