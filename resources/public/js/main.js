define(function(require) {

	$ = require("jquery");
	require("MathJaxConfig");

	EquationEditor = require("jsx!EquationCanvas");


$(function(){
	console.log("App Loaded.");
	setTimeout(function() {

	eqCanvas = new EquationEditor($("#container")[0]);
	}, 1000);
});	

});