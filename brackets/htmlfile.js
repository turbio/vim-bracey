var cheerio = require("cheerio");
var fs = require("fs");

var injectedCss = fs.readFileSync("frontend.css", 'utf8');
var injectedJs = fs.readFileSync("frontend.js", 'utf8');

function HtmlFile(path){
	if(path != undefined){
		this.path = path;
		var self = this;
		fs.readFile(path, 'utf8', function(err, data){
			self.rawSource = data;
			self.parse();
		});
	}
}

HtmlFile.prototype.parse = function(){
	this.parseToWeb();
	this.createElementPositions();
};

HtmlFile.prototype.webSrc = function(){
	if(this.webParsed != undefined){
		return this.webParsed.html();
	}else{
		throw 'source not parsed';
	}
};

HtmlFile.prototype.tagNumFromPos = function(column, line){
	throw 'not implemented';
}

//parse vim source into web source
HtmlFile.prototype.parseToWeb = function(){
	var webParsed = cheerio.load(this.rawSource, {
		normalizeWhitespace: true	//just cause
	});

	webParsed("*").each(function(i, elem){
		webParsed(this).attr('data-brackets-id', i);
	});

	webParsed("head").append('<script>' + injectedJs + '</script>');
	webParsed("head").append('<style>' + injectedCss + '</style>');

	this.webParsed = webParsed;
}

//make a list of elementNumbers and their correspoding start and end line
//this makes it much easier to get an elementNumber from the current
//cursor positions in the future
HtmlFile.prototype.createElementPositions = function(){
	this.elementPositions = [];

	var lines = this.rawSource.split('\n');
	var maxLine = lines.length;

	var parser = {
		lines: lines,
		maxLine: maxLine,
		elementPositions: [],
		maxColumn: function(line){
			if(line < lines.length){
				return lines[line].length;
			}else{
				return null;
			}
		},
		forwardUntil: function(line, column, searchChars){
			if(searchChars.constructor !== Array){
				searchChars = searchChars.split('');
			}

			var passedOver = '';
			var curChar = '';

			while((curChar = this.charAt(line, column)) !== null){
				passedOver += curChar;

				if(searchChars.indexOf(curChar) > -1){
					return {
						line: line,
						column: column,
						data: passedOver
					};
				}

				column++;
				if(column >= this.maxColumn(line)){
					column = 0;
					line++;
				}
			}

			return null;
		},
		//might want to cache this value, it's fetched a lot in the same line which
		//always returns the same value
		charAt: function(line, column){
			if(line < this.maxLine && column < this.maxColumn(line)){
				return this.lines[line][column];
			}else{
				return null;
			}
		},
		parse: function(){
			var tags = [];
			var parsedTag = this.parseNext();

			while(parsedTag !== null){
				tags.push(parsedTag);
				parsedTag = this.parseNext({
					line: parsedTag.end[0],
					column: parsedTag.end[1]
				});
			}

			return tags;
		},
		parseTag: function(line, column){
			//go the the start of a tag
			var tagStart = this.forwardUntil(line, column, '<');

			//if tatStart is null, then there is his (hopefully) not another
			//tag bacause eof was reached before anything was found
			if(tagStart == null){
				return null;
			}

			//an now to the end of the tag
			var tagEnd = this.forwardUntil(tagStart.line, tagStart.column, '>');
			if(tagEnd == null){
				return null;
			}

			//if we go to this point, it's (probably) a tag and thus
			//we can (probably) safely create a tag object
			var tag = {
				text: tagEnd.data,
				name: this.tagName(tagEnd.data),
				closing: tagEnd.data.startsWith('</'),
				selfclosing: false,
				start: [tagStart.line, tagStart.column],
				end: [tagEnd.line, tagEnd.column],
				children: []
			};

			return tag;
		},
		parseNext: function(state){
			if(state == undefined){
				state = {
					line: 0,
					column: 0,
				};
			}

			if((state.tag = this.parseTag(state.line, state.column)) == null){
				return null;
			}

			//if this tag closes, just return it
			if(state.tag.closing){
				return state.tag;
			}

			//otherwise, find the next tag starting from the last tag's
			//ending point
			nextTag = this.parseNext({
				line: state.tag.end[0],
				column: state.tag.end[1]
			});

			//if there's no next tag, return this frame's tag
			if(nextTag == null){
				return state.tag;
			}

			//if the next tag is closing
			if(nextTag.closing){
				//see if it closes this tag
				if(state.tag.name == nextTag.name){
					//and if so, change this tags end to where it's closing
					//tag (the next tag) ends, and return this
					state.tag.end = nextTag.end;
					return state.tag;
				}else{
					//if the next tag is closing, but does not close this tag,
					//this is (probably) a self closing tag
					//state.tag.children.push(nextTag);
					state.tag.selfclosing = true;
					nextTag.children.push(state.tag);
					return nextTag;
				}
			}else{
				state.tag.children.push(nextTag);
			}

			return state.tag;
		},
		tagName(tagStr){
			return tagStr.match(/<\/?\s*([a-zA-Z0-9]+).*>/)[1];
		}
	}

	//start parsing
	console.time('parsing');
	console.log(JSON.stringify(parser.parse(), null, 2));
	//console.log(parser.parse());
	console.timeEnd('parsing');
}

function cloneObject(obj){
	var target = {};
	for(var i in obj){
		if(obj.hasOwnProperty(i)){
			target[i] = obj[i];
		}
	}
	return target;
}

module.exports = HtmlFile;