define(function(require) {
	
	var $ = require("jquery");

	var React = require("react");

 
/////////////////////////////////
// Constructor
/////////////////////////////////

	function EquationCanvas(container) {
		console.log("Creating EquationCanvas in", container);

		this.canvas = <CanvasComponent />

		React.renderComponent(this.canvas, container);
	}

/////////////////////////////////
// Private static methods
/////////////////////////////////

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

/////////////////////////////////
// Private static component classes
/////////////////////////////////

	var Symbol = React.createClass({

		onClick: function(e) {
			return this.props.onClick(e, this.props.key || undefined);
		},

		onMouseDown: function(e) {
			return this.props.onMouseDown(e, this.props.key || undefined);
		},

		onMouseUp: function(e) {
			return this.props.onMouseUp(e, this.props.key || undefined);
		},

		render: function() {

			// Select which font to use, depending on the first character of the token.
			// Once we've chosen, resize the dummy mathjax to our required size, then ask for the font spec.

	    	var font = getFontForToken(this.props.token, this.props.fontSize);

		    // Get the left,top,width,height of the actual rendered character.

    		var bounds = measureText(this.props.token, font, this.props.fontSize, this.props.fontSize * 2);


			return (
				<div className={"symbol" + (this.props.selected ? " selected" : "")} 
					onClick={this.onClick} 
					onMouseDown={this.onMouseDown} 
					onMouseUp={this.onMouseUp} 
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

		componentWillReceiveProps: function() {
			this.setState(this.getInitialState());
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

	var CanvasComponent = React.createClass({

		getInitialState: function() {
			return {
				symbols: [],
				inputBox: null,
			};
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

			console.log("Input commit", x, y, fontSize, token);

			var symbols = this.state.symbols;

			symbols.push(<Symbol onClick={this.symbol_onClick} 
							     onMouseDown={this.symbol_onMouseDown}
							     onMouseUp={this.symbol_onMouseUp}
				                 selected={false} 
				                 token={token} 
				                 x={x}
				                 y={y} 
				                 fontSize={fontSize} 
				                 key={symbols.length}/>);

			this.setState({
				symbols: symbols,
				inputBox: null,
			});
		},

		canvas_onClick: function(e) {
			console.log("Canvas Click", e);

			var offset = $(this.getDOMNode()).offset();
			var x = e.pageX - offset.left
			var y = e.pageY - offset.top

			var fontSize = parseFloat($(this.getDOMNode()).css("font-size"));

			var inputBox = <InputBox x={x} y={y} fontSize={fontSize} onCommit={this.input_commit} onCancel={this.input_cancel}/>;

			this.setState({inputBox: inputBox});
		},

		canvas_onMouseDown: function(e) {

		},

		canvas_onMouseUp: function(e) {

		},

		canvas_onMouseMove: function(e) {

		},

		symbol_onClick: function(e,i) {
			console.log("SYMBOL CLICK", i, this.state.symbols[i]);
			e.preventDefault();
			return false;
		},

		symbol_onMouseDown: function(e,i) {
			e.preventDefault();
			return false;
		},

		symbol_onMouseUp: function(e,i) {
			e.preventDefault();
			return false;
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
				</div>
			);
		}
	});

	return EquationCanvas;
});