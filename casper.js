// ---------------------------------------------------------------------------
// CasperRenderer -- a class to render recorded tests to a CasperJS
// test format.
// ---------------------------------------------------------------------------

if (typeof(EventTypes) == "undefined") {
  EventTypes = {};
}

EventTypes.OpenUrl = 0;
EventTypes.Click = 1;
EventTypes.Change = 2;
EventTypes.Comment = 3;
EventTypes.Submit = 4;
EventTypes.CheckPageTitle = 5;
EventTypes.CheckPageLocation = 6;
EventTypes.CheckTextPresent = 7;
EventTypes.CheckValue = 8;
EventTypes.CheckValueContains = 9;
EventTypes.CheckText = 10;
EventTypes.CheckHref = 11;
EventTypes.CheckEnabled = 12;
EventTypes.CheckDisabled = 13;
EventTypes.CheckSelectValue = 14;
EventTypes.CheckSelectOptions = 15;
EventTypes.CheckImageSrc = 16;
EventTypes.PageLoad = 17;
EventTypes.ScreenShot = 18;
EventTypes.MouseDown = 19;
EventTypes.MouseUp = 20;
EventTypes.MouseDrag = 21;
EventTypes.MouseDrop = 22;

function CasperRenderer(document) {
  this.document = document;
  this.title = "Testcase";
  this.items = null;
  this.history = new Array();
  this.last_events = new Array();
  this.screen_id = 1;
  this.unamed_element_id = 1;
}

CasperRenderer.prototype.text = function(txt) {
  // todo: long lines
  this.document.writeln(txt);
}

CasperRenderer.prototype.stmt = function(text) {
  this.document.writeln(text);
}

CasperRenderer.prototype.cont = function(text) {
  this.document.writeln("    ... " + text);
}

CasperRenderer.prototype.pyout = function(text) {
  this.document.writeln("    " + text);
}

CasperRenderer.prototype.pyrepr = function(text) {
  // todo: handle non--strings & quoting
  return "'" + text + "'";
}

CasperRenderer.prototype.space = function() {
  this.document.write("\n");
}

var d = {};
d[EventTypes.OpenUrl] = "openUrl";
d[EventTypes.Click] = "click";
d[EventTypes.Change] = "change";
d[EventTypes.Comment] = "comment";
d[EventTypes.Submit] = "submit";
d[EventTypes.CheckPageTitle] = "checkPageTitle";
d[EventTypes.CheckPageLocation] = "checkPageLocation";
d[EventTypes.CheckTextPresent] = "checkTextPresent";
d[EventTypes.CheckValue] = "checkValue";
d[EventTypes.CheckText] = "checkText";
d[EventTypes.CheckHref] = "checkHref";
d[EventTypes.CheckEnabled] = "checkEnabled";
d[EventTypes.CheckDisabled] = "checkDisabled";
d[EventTypes.CheckSelectValue] = "checkSelectValue";
d[EventTypes.CheckSelectOptions] = "checkSelectOptions";
d[EventTypes.CheckImageSrc] = "checkImageSrc";
d[EventTypes.PageLoad] = "pageLoad";
d[EventTypes.ScreenShot] = "screenShot";
/* d[EventTypes.MouseDown] = "mousedown";
d[EventTypes.MouseUp] = "mouseup"; */
d[EventTypes.MouseDrag] = "mousedrag";
CasperRenderer.prototype.dispatch = d;

var cc = EventTypes;

CasperRenderer.prototype.render = function() {
  var etypes = EventTypes;
  this.document.open();
  this.document.write("<" + "pre" + ">");
  this.writeHeader();

  for (var i=0; i < this.items.length; i++) {
    var item = this.items[i];
    if (item.type == etypes.Comment)
      this.space();
    
    if(i==0) {
        if(item.type!=etypes.OpenUrl) {
            this.text("ERROR: the recorded sequence does not start with a url openning.");
        } else {
	        this.startUrl(item);
	        continue;
        }
    }
    if(i>1) {
        var before = this.items[i-1];
        // we do not want click due to user checking actions
        if(item.type==etypes.Click && 
                ((before.type>=etypes.CheckPageTitle && before.type<=etypes.CheckImageSrc) || before.type==etypes.ScreenShot)) {
            continue;
        }
    	// check mousedown / mouseup / click sequences
    	var before_before = this.items[i-2];
    	if(before_before.type==etypes.MouseDown && before.type==etypes.MouseUp) {
    		if(item.type!=etypes.Click) {
    			// click has been swallowed (return false), we dispatch
    			if(before_before.x == before.x && before_before.y == before.y) {
    				// same location, so it is a click
    				this[this.dispatch[etypes.Click]](before);
    			} else {
    				// different location, so it is a drag
    				before.before = before_before;
    				this[this.dispatch[etypes.MouseDrag]](before);
    			}
    		} else {
    			if(!(item.x && item.y) || (item.x == before.x && item.y == before.y)) {
                    // same location or element click: dispatch a click
                    this[this.dispatch[etypes.Click]](item);
                } else {
                    // different location, so it is a drag
                    item.before = before;
                    this[this.dispatch[etypes.MouseDrag]](item);
                }
    			continue;
    		}
    	}
    }
    if (this.dispatch[item.type]) {
      this[this.dispatch[item.type]](item);
    }
    if (item.type == etypes.Comment)
      this.space();
  }
  this.writeFooter();
  this.document.write("<" + "/" + "pre" + ">");
  this.document.close();
}

CasperRenderer.prototype.writeHeader = function() {
  var date = new Date();
  this.text("//==============================================================================");
  this.text("// Casper generated " + date);
  this.text("//==============================================================================");
  this.space();
  this.stmt("var x = require('casper').selectXPath;");
  this.stmt("var casper = require('casper').create();");
}
CasperRenderer.prototype.writeFooter = function() {
	  this.space();
	  this.stmt("casper.run(function() {this.test.renderResults(true);});");
	}
CasperRenderer.prototype.rewriteUrl = function(url) {
  return url;
}

CasperRenderer.prototype.shortUrl = function(url) {
  return url.substr(url.indexOf('/', 10), 999999999);
}

CasperRenderer.prototype.startUrl = function(item) {
  var url = this.pyrepr(this.rewriteUrl(item.url));
  this.stmt("casper.options.viewportSize = {width: "+item.width+", height: "+item.height+"};");
  this.stmt("casper.start(" + url + ");");        
}
CasperRenderer.prototype.openUrl = function(item) {
  var url = this.pyrepr(this.rewriteUrl(item.url));
  var history = this.history;
  // if the user apparently hit the back button, render the event as such
  if (url == history[history.length - 2]) {
	  this.stmt('casper.then(function() {');
	  this.stmt('    this.back();');
	  this.stmt('});');
	  history.pop();
	  history.pop();
  } else {
	  this.stmt("casper.thenOpen(" + url + ");");
  }
}

CasperRenderer.prototype.pageLoad = function(item) {
  var url = this.pyrepr(this.rewriteUrl(item.url));
  this.history.push(url);
}

CasperRenderer.prototype.normalizeWhitespace = function(s) {
  return s.replace(/^\s*/, '').replace(/\s*$/, '').replace(/\s+/g, ' ');
}

CasperRenderer.prototype.getControl = function(item) {
  var type = item.info.type;
  var tag = item.info.tagName.toLowerCase();
  var selector;
  if ((type == "submit" || type == "button") && item.info.value)
    selector = tag+'[type='+type+'][value='+this.pyrepr(this.normalizeWhitespace(item.info.value))+']';
  else if (item.info.name)
	selector = tag+'[name='+this.pyrepr(item.info.name)+']';
  else if (item.info.id)
	selector = tag+'#'+item.info.id;
  else
	selector = 'TODO';

  return selector;
}
	
CasperRenderer.prototype.getControlXPath = function(item) {
  var type = item.info.type;
  var way;
  if ((type == "submit" || type == "button") && item.info.value)
    way = '@value=' + this.pyrepr(this.normalizeWhitespace(item.info.value));
  else if (item.info.name)
    way = '@name=' + this.pyrepr(item.info.name);
  else if (item.info.id)
	way = '@id=' + this.pyrepr(item.info.id);
  else
    way = 'TODO';

  return way;
}

CasperRenderer.prototype.getLinkXPath = function(item) {
  var way;
  if (item.text)
    way = 'normalize-space(text())=' + this.pyrepr(this.normalizeWhitespace(item.text));
  else if (item.info.id)
    way = '@id=' + this.pyrepr(item.info.id);
  else if (item.info.href)
    way = '@href=' + this.pyrepr(this.shortUrl(item.info.href));
  else if (item.info.title)
    way = 'title='+this.pyrepr(this.normalizeWhitespace(item.info.title));
  else 
    way = 'TODO';

  return way;
}

CasperRenderer.prototype.mousedrag = function(item) {
    this.stmt('casper.then(function() {');
    this.stmt('    this.mouse.down('+ item.before.x + ', '+ item.before.y +');');
    this.stmt('    this.mouse.move('+ item.x + ', '+ item.y +');');
    this.stmt('    this.mouse.up('+ item.x + ', '+ item.y +');');
    this.stmt('});');
}
CasperRenderer.prototype.click = function(item) {
  var tag = item.info.tagName.toLowerCase();
  if(!(tag == 'a' || tag == 'input' || tag == 'button')) {
	this.stmt('casper.then(function() {');
	this.stmt('    this.mouse.click('+ item.x + ', '+ item.y +');');
	this.stmt('});');
  } else {
	var selector;
	if (tag == 'a') {
	  selector = 'x("//a['+this.getLinkXPath(item)+']")';
	} else if (tag == 'input' || tag == 'button') {
	  selector = this.getFormSelector(item) + ' ' + this.getControl(item);
	  selector = '"' + selector + '"';
	}
	this.stmt('casper.waitForSelector('+ selector + ',');
    this.stmt('    function success() {');
	this.stmt('        this.test.assertExists('+ selector + ');');
	this.stmt('        this.click('+ selector + ');');
	this.stmt('    },');
    this.stmt('    function fail() {');
    this.stmt('        this.test.assertExists(' + selector + ');')
	this.stmt('});');
  }
}

CasperRenderer.prototype.getFormSelector = function(item) {
	var info = item.info;
	if(!info.form) {
		return 'form';
	}
	if(info.form.name) {
        return "form[name=" + info.form.name + "]";
    } else if(info.form.id) {
		return "form#" + info.form.id;
	} else {
		return "form";
	}
}

CasperRenderer.prototype.change = function(item) {
  var type = item.info.type;
  if(!item.info.name || item.info.name=='') {
      var path = this.getControl(item);
      var name = "unamed_field_"+this.unamed_element_id;
      item.info.name = name;
      this.unamed_element_id = this.unamed_element_id + 1;
      this.stmt('casper.waitForSelector('+path+', function() {');
      this.stmt('    casper.evaluate(function() {');
      this.stmt('        var element = document.querySelectorAll('+path+')[0];');
      this.stmt('        element.name="'+name+'";');
      this.stmt('    });');
      this.stmt('});');
  }
  var value = this.pyrepr(item.info.value);
  this.stmt('casper.waitForSelector("' + this.getFormSelector(item) + '",');
  this.stmt('    function success() {');
  this.stmt('        this.fill("' + this.getFormSelector(item) + '", {"' + item.info.name + '": "'+ item.info.value +'"});');
  this.stmt('    },');
  this.stmt('    function fail() {');
  this.stmt('        this.test.assertExists("' + this.getFormSelector(item) + '");')
  this.stmt('});');
}

CasperRenderer.prototype.submit = function(item) {
  // the submit has been called somehow (user, or script)
  // so no need to trigger it.
  this.stmt("// submit form");
}

CasperRenderer.prototype.screenShot = function(item) {
  // wait 1 second is not the ideal solution, but will be enough most
  // part of time. For slow pages, an assert before capture will make
  // sure evrything is properly loaded before screenshot.
  this.stmt('casper.wait(1000);');
  this.stmt('casper.then(function() {');
  this.stmt('    this.captureSelector("screenshot'+this.screen_id+'.png", "html");');
  this.stmt('});');
  this.screen_id = this.screen_id + 1;
}

CasperRenderer.prototype.comment = function(item) {
	var lines = item.text.split('\n');
	this.stmt('casper.then(function() {');
	for (var i=0; i < lines.length; i++) {
	  this.stmt('    this.test.comment("'+lines[i]+'");');
	}
	this.stmt('});');
}

CasperRenderer.prototype.checkPageTitle = function(item) {
  var title = this.pyrepr(item.title);
  this.stmt('casper.then(function() {');
  this.stmt('    this.test.assertTitle('+ title +');');
  this.stmt('});');
}

CasperRenderer.prototype.checkPageLocation = function(item) {
  var url = item.url.replace(new RegExp('/', 'g'), '\\/');
  this.stmt('casper.then(function() {');
  this.stmt('    this.test.assertUrlMatch(/^'+ url +'$/);');
  this.stmt('});');
}

CasperRenderer.prototype.checkTextPresent = function(item) {
    var selector = 'x("//*[contains(text(), '+this.pyrepr(item.text)+')]")';
    this.waitAndTestSelector(selector);
}

CasperRenderer.prototype.checkValue = function(item) {
  var type = item.info.type;
  var way = this.getControlXPath(item);
  var selector = '';
  if (type == 'checkbox' || type == 'radio') {
    var selected;
    if (item.info.checked)
      selected = '@checked'
    else
      selected = 'not(@checked)'
    selector = 'x("//input[' + way + ' and ' +selected+ ']")';
  }
  else {
    var value = this.pyrepr(item.info.value)
    var tag = item.info.tagName.toLowerCase();
    selector = 'x("//'+tag+'[' + way + ' and @value='+value+']")';
  }
  this.waitAndTestSelector(selector);
}

CasperRenderer.prototype.checkText = function(item) {
  var selector = '';
  if ((item.info.type == "submit") || (item.info.type == "button")) {
      selector = 'x("//input[@value='+this.pyrepr(item.text)+']")';
  } else {
      selector = 'x("//*[normalize-space(text())='+this.pyrepr(item.text)+']")';
  }
  this.waitAndTestSelector(selector);
}

CasperRenderer.prototype.checkHref = function(item) {
	var selector = this.getLinkXPath(item);
	var href = this.pyrepr(this.shortUrl(item.info.href));
    this.stmt('casper.then(function() {');
    this.stmt('    this.test.assertExists(x("//a[' + way + ' and @href='+ href +']"));');
    this.stmt('});');
}

CasperRenderer.prototype.checkEnabled = function(item) {
	  var way = this.getControlXPath(item);
	  var tag = item.info.tagName.toLowerCase();
	  this.waitAndTestSelector('x("//'+tag+'[' + way + ' and not(@disabled)]")');
}

CasperRenderer.prototype.checkDisabled = function(item) {
  var way = this.getControlXPath(item);
  var tag = item.info.tagName.toLowerCase();
  this.waitAndTestSelector('x("//'+tag+'[' + way + ' and @disabled]")');
}

CasperRenderer.prototype.checkSelectValue = function(item) {
  var value = this.pyrepr(item.info.value);
  var way = this.getControlXPath(item);
  this.waitAndTestSelector('x("//select[' + way + ']/options[@selected and @value='+value+']")');
}

CasperRenderer.prototype.checkSelectOptions = function(item) {
	this.stmt('// TODO');
}

CasperRenderer.prototype.checkImageSrc = function(item) {
	var src = this.pyrepr(this.shortUrl(item.info.src));
	this.waitAndTestSelector('x("//img[@src=' + src + ']")');
}

CasperRenderer.prototype.waitAndTestSelector = function(selector) {
	this.stmt('casper.waitForSelector(' + selector + ',');
	this.stmt('    function success() {');
	this.stmt('        this.test.assertExists(' + selector + ');')
	this.stmt('      },');
	this.stmt('    function fail() {');
	this.stmt('        this.test.assertExists(' + selector + ');')
	this.stmt('});');
}
var dt = new CasperRenderer(document);
window.onload = function onpageload() {
    chrome.extension.sendRequest({action: "get_items"}, function(response) {
        dt.items = response.items;
        dt.render();
    });
};