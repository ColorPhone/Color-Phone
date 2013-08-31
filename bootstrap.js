/* ***** BEGIN LICENSE BLOCK *****
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/
 * 
 * Contributor(s):
 *   Diego Casorran <dcasorran@gmail.com> (Original Author)
 * 
 * ***** END LICENSE BLOCK ***** */

let {classes:Cc,interfaces:Ci,utils:Cu,results:Cr} = Components,addon;

Cu.import("resource://gre/modules/Services.jsm")

function rsc(n) 'resource://' + addon.tag + '/' + n;
function LOG(m) (m = addon.name + ' Message @ '
	+ (new Date()).toISOString() + "\n> " + m,
		dump(m + "\n"), Services.console.logStringMessage(m));

let isMobile = ~['{aa3c5121-dab2-40e2-81ca-7ea25febc110}',
	'{a23983c0-fd0e-11dc-95ff-0800200c9a66}'].indexOf(Services.appinfo.ID);

let i$ = {
	onOpenWindow: function(aWindow) {
		let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
		loadIntoWindowStub(domWindow);
	},
	onCloseWindow: function() {},
	onWindowTitleChange: function() {}
};

(function(global) global.loadSubScript = function(file,scope)
	Services.scriptloader.loadSubScript(file,scope||global))(this);

function loadIntoWindow(window) {
	if(!(/^chrome:\/\/(browser|navigator)\/content\/\1\.xul$/.test(window&&window.location)))
		return;
	
	function c(n) window.document.createElement(n);
	function $(n) window.document.getElementById(n);
	function e(n,a,e,p) {
		if(!(n = c(n)))
			return null;
		
		if(a)for(let x in a)n.setAttribute(x,''+a[x]);
		if(e)for(let i = 0, m = e.length ; i < m ; ++i ) {
			if(e[i]) n.appendChild(e[i]);
		}
		if(p)p.appendChild(n);
		return n;
	}
	
	loadSubScript(rsc('browser.js'), window);
	window.diegocr[addon.tag].mob = isMobile;
	window.diegocr[addon.tag].addon = addon;
	window.diegocr[addon.tag].LOG = LOG;
	window.diegocr[addon.tag].rsc = rsc;
	
	if(isMobile)
		return;
	
	let wmsData = {
		TBBHandler: function(ev) {
			
			try {
				window.diegocr[addon.tag].l()
			} catch(e) {
				Cu.reportError(e);
			}
		}
	};
	
	let gNavToolbox = window.gNavToolbox || $('navigator-toolbox');
	if(gNavToolbox && gNavToolbox.palette.id == 'BrowserToolbarPalette') {
		let m=addon.tag+'-toolbar-button', nv=$('nav-bar');
		gNavToolbox.palette.appendChild(e('toolbarbutton',{
			id:m,label:addon.name,class:'toolbarbutton-1',
			tooltiptext:addon.name,image:rsc('icon16.png')
		})).addEventListener('command', wmsData.TBBHandler, !1);
		
		if( nv ) {
			if(!addon.branch.getPrefType("version")) {
				nv.insertItem(m, null, null, false);
				nv.setAttribute("currentset", nv.currentSet);
				window.document.persist(nv.id, "currentset");
			} else {
				[].some.call(window.document.querySelectorAll("toolbar[currentset]"),
					function(tb) {
						let cs = tb.getAttribute("currentset").split(","),
							bp = cs.indexOf(m) + 1;
						
						if(bp) {
							let at = null;
							cs.splice(bp).some(function(id) at = $(id));
							nv.insertItem(m, at, null, false);
							return true;
						}
					});
			}
		}
		
		let (mps = $('mainPopupSet')) {
			try {
				e('tooltip',{id:addon.tag+'-tooltip',orient:'vertical'},0,mps)
					.addEventListener('popupshowing', wmsData.popupshowing = function(ev) {
						try {
							return window.diegocr[addon.tag].l(ev);
						} catch(e) {
							Cu.reportError(e);
						}
					}, !0);
				
				let (p = $(m)) {
					p.setAttribute('tooltip',addon.tag+'-tooltip');
				}
			} catch(e) {
				LOG(e);
			}
		}
	}
	
	addon.wms.set(window,wmsData);
	gNavToolbox = null;
}

function loadIntoWindowStub(domWindow) {
	
	if(domWindow.document.readyState == "complete") {
		loadIntoWindow(domWindow);
	} else {
		domWindow.addEventListener(isMobile? "UIReady":"load", function(ev) {
			domWindow.removeEventListener(ev.type, arguments.callee, false);
			loadIntoWindow(domWindow);
		}, false);
	}
}

function unloadFromWindow(window) {
	let $ = function(n) window.document.getElementById(n);
	let btnId = addon.tag+'-toolbar-button',btn= $(btnId);
	
	try {
		window.diegocr[addon.tag].handleEvent({type:'unload'});
		delete window.diegocr[addon.tag];
	} catch(e) {
		Cu.reportError(e);
	}
	
	if(isMobile)
		return;
	
	if(addon.wms.has(window)) {
		let wmsData = addon.wms.get(window);
		
		if(wmsData.TBBHandler && btn) {
			btn.removeEventListener('command',wmsData.TBBHandler,!1);
		}
		if(wmsData.popupshowing) {
			let tt = $(addon.tag+'-tooltip');
			if(tt) tt.removeEventListener('popupshowing', wmsData.popupshowing, !1);
		}
		addon.wms.delete(window);
	}
	
	if(btn) {
		btn.parentNode.removeChild(btn);
	} else {
		let gNavToolbox = window.gNavToolbox || $('navigator-toolbox');
		if(gNavToolbox && gNavToolbox.palette.id == 'BrowserToolbarPalette') {
			for each(let node in gNavToolbox.palette) {
				if(node && node.id == btnId) {
					gNavToolbox.palette.removeChild(node);
					break;
				}
			}
		}
	}
	
	let n;
	if((n = $(addon.tag+'-tooltip')))
		n.parentNode.removeChild(n);
}

function startup(data) {
	let tmp = {};
	Cu.import("resource://gre/modules/AddonManager.jsm", tmp);
	tmp.AddonManager.getAddonByID(data.id,function(data) {
		let io = Services.io, wm = Services.wm;
		
		addon = {
			id: data.id,
			name: data.name,
			version: data.version,
			tag: data.name.toLowerCase().replace(/[^\w]/g,''),
			wms: new WeakMap()
		};
		addon.branch = Services.prefs.getBranch('extensions.'+addon.tag+'.');
		
		for(let [k,v] in Iterator({
			enabled   : !0,
			skipwhen  : 'docs\\.google\\.com|ServiceLogin|imgres\\?|watch%3Fv|'
				+ 'share|translate|tweet|(?:timeline|like(?:box)?|landing|bookmark'
				+ ')\.php|submit\\?(?:url|phase)=|\\+1|signup',
			remove    : '(?:ref|aff)\\w*|utm_\\w+|(?:merchant|programme|media)ID',
			highlight : !0,
			evdm      : !0
		})) {
			if(!addon.branch.getPrefType(k)) {
				switch(typeof v) {
					case 'boolean': addon.branch.setBoolPref (k,v); break;
					case 'number':  addon.branch.setIntPref  (k,v); break;
					case 'string':  addon.branch.setCharPref (k,v); break;
				}
			}
		}
		
		io.getProtocolHandler("resource")
			.QueryInterface(Ci.nsIResProtocolHandler)
			.setSubstitution(addon.tag,
				io.newURI(__SCRIPT_URI_SPEC__+'/../',null,null));
		
		let windows = wm.getEnumerator("navigator:browser");
		while(windows.hasMoreElements()) {
			let diegocr = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
			loadIntoWindowStub(diegocr);
		}
		wm.addListener(i$);
		
		// i$.startup();
		addon.branch.setCharPref('version', addon.version);
	});
}

function shutdown(data, reason) {
	
	if(reason == APP_SHUTDOWN)
		return;
	
	// i$.shutdown();
	
	Services.wm.removeListener(i$);
	
	let windows = Services.wm.getEnumerator("navigator:browser");
	while(windows.hasMoreElements()) {
		let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
		unloadFromWindow(domWindow);
	}
	
	Services.io.getProtocolHandler("resource")
		.QueryInterface(Ci.nsIResProtocolHandler)
		.setSubstitution(addon.tag,null);
}

function install(data, reason) {}
function uninstall(data, reason) {}
