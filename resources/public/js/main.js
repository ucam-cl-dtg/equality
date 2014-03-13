define(function(require) {

	$ = require("jquery");
	require("MathJaxConfig");

	EquationCanvas = require("jsx!EquationCanvas");


$(function(){
	console.log("App Loaded.");

	eqCanvas = new EquationCanvas($("#container")[0]);
});	

});