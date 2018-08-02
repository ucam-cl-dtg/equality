require.config({

    baseUrl: 'js',

    //urlArgs: "bust=" + (new Date()).getTime(),

    paths: {
        react: 'react/react-with-addons',
        JSXTransformer: 'react/JSXTransformer',
        jquery: '//code.jquery.com/jquery-1.11.0.min',
        mathjax: '//cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js?config=TeX-AMS-MML_HTMLorMML'
    },
});

var app = {}

require(["main"]);
