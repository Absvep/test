//API
const router = require('koa-router')();

var request = require('requestretry');
var cheerio = require ("cheerio");
var async= require("async");
var he = require("he");
var random_useragent = require('libraries/changedlib/random-useragent'); //Need to change to your path here.
var NoBrand = false;

let Carinfo = require('libraries/db').Carinfo

function checkInternet(cb) {
	require('dns').lookup('google.com',function(err) {
		if (err && err.code == "ENOTFOUND") {
			cb(false);
		} else {
			cb(true);
		}
	})
}

router.get('/api/search-car/:regnr', async (ctx) => {
	var urls = {};
	var MyLink = 'http://biluppgifter.se/fordon/' + ctx.params.regnr;
	
	let parsedData = await CallUrl(MyLink)

	if(parsedData && parsedData.SearchValid){
		parsedData = Object.assign({}, parsedData.Cardata, parsedData.Technicdata, parsedData.Valuedata, parsedData.Historicdata, parsedData.Dimensionsdata, parsedData.Otherdata)
		var fields = {};
		Object.assign(fields,
			{Brand: parsedData.Brand}, //Brand = "LAND ROVER"
			//parsedData.CarModel ? {CarModelBU: parsedData.CarModel} : {}, //Removed because updated CarModelBU, so drop it. 
			parsedData.HorsePowers ? {HorsePowers: parsedData.HorsePowers} : {}, //HorsePowers = 179
			parsedData.Kw ? {Kw: parsedData.Kw} : {}, //Kw = 132
			parsedData.ProductionYear ? {ProductionYear: parsedData.ProductionYear} : {}, //ProductionYear = 2015
			parsedData.Fuel ? {Fuel: parsedData.Fuel} : {}, //Fuel = "DIESEL"
			parsedData.Co2Emission ? {Co2Emission: parsedData.Co2Emission} : {}, //Co2Emission = 134
			parsedData.DriveGear ? {DriveGear: parsedData.DriveGear} : {}, //DriveGear = "FYRHJULSDRIVEN"
			parsedData.Gear ? { Gear: parsedData.Gear } : {}, // Gear not present in this case
			//parsedData.Consumption ? {Consumption: parsedData.Consumption} : {}, //Consumption = "5.1 LITER/100KM"
			//parsedData.EngineVolume ? {EngineVolume: parsedData.EngineVolume} : {},
			parsedData.Weigth ? {Weigth: parsedData.Weigth} : {},
			parsedData.TotalWeigth ? {TotalWeigth: parsedData.TotalWeigth} : {},
			parsedData.SoundWhileDrive ? {TotalWeigth: parsedData.TotalWeigth} : {}
		);
		
		let car = await Carinfo.findOne(fields, {})

		if(car){
			car = JSON.parse(JSON.stringify(car))

			parsedData._id = car._id
			parsedData.CarModelBlocket = car.CarModelBlocket
			parsedData.Model = car.Model
			parsedData.Family = car.Family

			ctx.body = parsedData
		}
		else{
			ctx.body = {
				error: 'We have no data for that car'
			}
		}
	}
	else{
		ctx.body = {
			error: 'Invalid regnr'
		}
	}	
});

function CallUrl(name) {
	var	returnjson = {};
	var ThisUserAgent = random_useragent.getRandom();
	return new Promise((resolve, reject) => {
	request({
		url:name,
		headers: {
					'User-Agent': ThisUserAgent //Random UserAgent at each page request.
				},
				timeout: 6000,
				// The above parameters are specific to Request-retry
  				maxAttempts: 555,   // (default) try 5 times
  				retryDelay: 5000,  // (default) wait for 5s before trying again
  				retryStrategy: request.RetryStrategies.HTTPOrNetworkError // (default) retry on 5xx or network errors}
  			}, function (error, response, body) {
  				if (response) {
  					if (error) return reject(error);
  					var $ = cheerio.load(body);

				//Check if regnr is not present
				if(!($("div.card.card-body.mb-xs-4").length)) {
					returnjson["SearchValid"] = false;
					return resolve(null,returnjson);
				} else{
					returnjson["SearchValid"] = true;
				}

				//Check if Scores are present
				if(($("section.grade"))) {
					fscorepresentvalue = true;
				} else{
					fscorepresentvalue = false;
				}				
				
				//Check if Ownertext present (JUST NU EJ AKTIVT PÅ HEMSIDAN)
				if(($("#owner em").length)) {
					fownerpresentvalue = true;
					//console.log(fownerpresentvalue);
				} else{
					fownerpresentvalue = false;
					//console.log(fownerpresentvalue);
				}				
				//Check if fordonsdata is present
				if(($("div.card-body.card-data"))) {
					fdatapresentvalue = true;
				} else{
					fdatapresentvalue = false;
				}		

				//Check if andrabilar present (JUST NU EJ AKTIVT PÅ HEMSIDAN)
				if(($("div#owner.section em a.no-break").html())) {
					otherscarsvalue = true;
				} else{
					otherscarsvalue = false;				
				}	

				//Check if history is present
				if(($("div.card-body.card-history"))) {
					fhistpresentvalue = true;
				} else{
					fhistpresentvalue = false;
				}

				//Check if technicaldata is present
				if($("div.card-body.card-technical h2").text() == "Teknisk data") {
					ftechpresentvalue = true;
				} else{
					ftechpresentvalue = false;
				}

				//Check if dimensions is present
				if($("div.card-body.card-technical h3").text().indexOf("Dimensioner") !== -1) {
					fdimpresentvalue = true;
				} else{
					fdimpresentvalue = false;
				}

				//Check if övrigt is present
				if($("div.card-body.card-technical h3").text().indexOf("Övrigt") !== -1) {
					fothpresentvalue = true;
				} else{
					fothpresentvalue = false;
				}				

				async.waterfall([
					function (next) {
				//Dimensions					
				if(fscorepresentvalue){
					var fscovals = [];
					$("section.grade div.row div div strong").each(function(){
						var fsco = $(this).html();
						fscovals.push(fsco);
					});	
					fscojson = {};
					thetitle = [];
					thecontext = [];

					for(i=0; i<=((fscovals.length)-1); i++) {
						if(fscovals[i]){
							fscovals[i] = he.decode(fscovals[i]);
							thetitle[i] = fscovals[i].split(" ")[0].trim();
							thecontext[i] = fscovals[i].split(" ")[1].trim();
							switch (thetitle[i]) {
							    case "Miljö":
							        thetitle[i] = "Ecology";
							        break;
							    case "Ekonomi":
							        thetitle[i] = "Economy";
							        break;
							    case "Prestanda":
							        thetitle[i] = "Performance";
							        break;
							    default:
							        thetitle[i] = thetitle[i];								        
							}							
							if(typeof(thecontext[i]) == "string"){
								thecontext[i] = thecontext[i].toUpperCase();
							}							
							fscojson[thetitle[i]] = thecontext[i];
						}
					}
					returnjson["Valuedata"] = fscojson;
				} else{
					returnjson["Valuedata"] = {};						
				}	
				next(null,returnjson);
			},		
			function (returnjson, next) {					    	
				//Fordonsdata					
				if(fdatapresentvalue){
					var fdatavals = [];
					$("div.card.card-body.card-data ul.list-detailed.enlarge li").each(function(){
						var val = $(this).html();
						//var val = $(this).clone().children("em").remove().end().text().trim();
						//thisLoc = $(this).clone().children("p").remove().end().text().replace(/[\n\t\r]/g, "").trim().toUpperCase().trim();
						fdatavals.push(val);
					});	

					ftechjson = {};
					thetitle = [];
					thecontext = [];
					for(i=0; i<=((fdatavals.length)-1); i++) {
						if(fdatavals[i]){
							fdatavals[i] = he.decode(fdatavals[i]);
							if(fdatavals[i].indexOf("<span>")) {
								thetitle[i] = fdatavals[i].substr(0,fdatavals[i].indexOf("<span>")).trim(); //Den Gamla innan <em> taggen kom fdatavals[i].match(/.+?(?=<)/)[0].trim();
							} else {
								thetitle[i] = fdatavals[i].substr(0,fdatavals[i].indexOf('<span id="nmvits-data">')).trim();
							}
								//Ändrar väsentliga grejer till engelska
								switch (thetitle[i]) {
								    case "Registreringsnummer":
								        thetitle[i] = "RegNr";
								        break;
								    case "Chassinr / VIN":
								        thetitle[i] = "ChassiNr";
								        break;
								    case "Trafik i Sverige":
								        thetitle[i] = "InTraficSweden";
								        break;	
								    case "Nästa besiktning":
								        thetitle[i] = "NextTest";
								        break;
								    case "Försäkring":
								        thetitle[i] = "Insurance";
								        break;									        									        							        
								    case "Fabrikat":
								        thetitle[i] = "Brand";
								        break;
								    case "Import / Införsel":
								        thetitle[i] = "Import";
								        break;
								    case "Först registrerad":
								        thetitle[i] = "FirstRegistration";
								        break;
								    case "Antal ägare":
								        thetitle[i] = "NumberOfOwners";
								        break;
								    case "Senaste ägarbyte":
								        thetitle[i] = "LatestOwnerChange";
								        break;
								    case "Senast besiktigad":
								        thetitle[i] = "LatestTested";
								        break;
								    case "Leasad":
								        thetitle[i] = "Leased";
								        break;
								    case "Senaste ägarbyte":
								    	thetitle[i] = "LatestOwnerChange0";
								    	break;
								    case "Mätarställning":
								    	thetitle[i] = "Milage";
								    	break;
								    case "Årlig skatt":
								    	thetitle[i] = "YearlyTax";
								    	break;
								    case "Skattemånad":
								    	thetitle[i] = "TaxMonth";	
								    	break;							    									    
								    default:
								        thetitle[i] = thetitle[i];								        
								}
								//console.log(fdatavals[i].match(/>(.*?)</)[1].trim())
								if(fdatavals[i].indexOf('<span id="nmvits-data">') > -1) {
									thecontext[i] =  fdatavals[i].substr(fdatavals[i].indexOf('<span id="nmvits-data">')).replace('<span id="nmvits-data">',"").replace('</span>',"").trim();
								} else {
									thecontext[i] = fdatavals[i].match(/>(.*?)</)[1].trim();
								}
								if(typeof(thecontext[i]) == "string"){
									thecontext[i] = thecontext[i].toUpperCase();
								}
								ftechjson[thetitle[i]] = thecontext[i];
							}
						}

						returnjson["Cardata"] = ftechjson;
						delete returnjson.Cardata["Modell"];
						//console.log("Före" + " " + returnjson.Cardata["Brand"]);
						//MÅSTE TA BORT Å,Ä,Ö då scrapern tar bort dessa bokstäver.
						returnjson.Cardata["Brand"] = $("div.card.card-body.mb-xs-4 h1.card-title").text().toUpperCase()
												   	  .replace("Å","")
													  .replace("Ä","")
													  .replace("Ö","");	
						//Om RANGE är första ordet då märke LAND ROVER (OKM635).							  
						if(returnjson.Cardata["Brand"].substr(0,returnjson.Cardata["Brand"].indexOf(' ')) == "RANGE"){
							returnjson.Cardata["CarModel"] = returnjson.Cardata["Brand"]
													         .substr(returnjson.Cardata["Brand"].indexOf(' ')+1,
													         returnjson.Cardata["Brand"].length)
													         .replace(/[^\w\d]/gi, '').replace(/\s/g,"");
							returnjson.Cardata["Brand"] = "LAND ROVER";						         
						} else{
							//Om LAND är första ordet då ta 2 första ord så blir LAND ROVER (SLN544).							  
							if(returnjson.Cardata["Brand"].substr(0,returnjson.Cardata["Brand"].indexOf(' ')) == "LAND"){
								returnjson.Cardata["CarModel"] = returnjson.Cardata["Brand"]
														         .substr(returnjson.Cardata["Brand"].indexOf(' ',
														         returnjson.Cardata["Brand"].indexOf(' ')+1))
														         .replace(/[^\w\d]/gi, '').replace(/\s/g,"");
								returnjson.Cardata["Brand"] = "LAND ROVER";													         
							} else{
								//Om brand LAND-ROVER
								if(returnjson.Cardata["Brand"].substr(0,returnjson.Cardata["Brand"].indexOf(' ')) == "LAND-ROVER"){
									returnjson.Cardata["CarModel"] = returnjson.Cardata["Brand"]
															         .substr(returnjson.Cardata["Brand"].indexOf(' ')+1,
															         returnjson.Cardata["Brand"].length)
															         .replace(/[^\w\d]/gi, '').replace(/\s/g,"");
									returnjson.Cardata["Brand"] = "LAND ROVER";													         							
								} else{
									if(returnjson.Cardata["Brand"].substr(0,returnjson.Cardata["Brand"].indexOf(' ')) == "VW"){
										returnjson.Cardata["CarModel"] = returnjson.Cardata["Brand"]
																         .substr(returnjson.Cardata["Brand"].indexOf(' ')+1,
																         returnjson.Cardata["Brand"].length)
																         .replace(/[^\w\d]/gi, '').replace(/\s/g,"");
										returnjson.Cardata["Brand"] = "VOLKSWAGEN";	
									} else {
										if(returnjson.Cardata["Brand"].substr(0,returnjson.Cardata["Brand"].indexOf(' ')) == "MERCEDES"){
											returnjson.Cardata["CarModel"] = returnjson.Cardata["Brand"]
																         	.substr(returnjson.Cardata["Brand"].indexOf(' ')+1,
																         	returnjson.Cardata["Brand"].length)
																         	.replace(/[^\w\d]/gi, '').replace(/\s/g,"");											
											returnjson.Cardata["Brand"] = "MERCEDES-BENZ";
										} else{
											if(returnjson.Cardata["Brand"].substr(0,returnjson.Cardata["Brand"].indexOf(' ')) == "ROVER" ||
												returnjson.Cardata["Brand"].substr(0,returnjson.Cardata["Brand"].indexOf(' ')) == "MG" ||
												returnjson.Cardata["Brand"].replace(/\s/g,"").substr(0,10) == "AUSTINMINI") {
												returnjson.Cardata["CarModel"] = returnjson.Cardata["Brand"]
																	         	.substr(returnjson.Cardata["Brand"].indexOf(' ')+1,
																	         	returnjson.Cardata["Brand"].length)
																	         	.replace(/[^\w\d]/gi, '').replace(/\s/g,"");											
												returnjson.Cardata["Brand"] = "ROVER/BMC";												
											} else {
												if(returnjson.Cardata["Brand"].substr(0,returnjson.Cardata["Brand"].indexOf(' ')) == "SSANGYONG") {
													returnjson.Cardata["CarModel"] = returnjson.Cardata["Brand"]
																		         	.substr(returnjson.Cardata["Brand"].indexOf(' ')+1,
																		         	returnjson.Cardata["Brand"].length)
																		         	.replace(/[^\w\d]/gi, '').replace(/\s/g,"");											
													returnjson.Cardata["Brand"] = "SSANG YONG";													
												} else {
													//Alla andra.															          
													if(returnjson.Cardata["Brand"]){

														returnjson.Cardata["CarModel"] = returnjson.Cardata["Brand"]
														.substr(returnjson.Cardata["Brand"].indexOf(' ')+1,
														returnjson.Cardata["Brand"].length)											          
														.replace(/[^\w\d]/gi, '').replace(/\s/g,"");

														returnjson.Cardata["Brand"] = returnjson.Cardata["Brand"]
																		          .substr(0,returnjson.Cardata["Brand"].indexOf(' '));
												    } else {
												    	returnjson.Cardata["Brand"] = "BLAAAAAAAAA23423423434234234"; //Om finns ingen brand.
												    	returnjson.Cardata["CarModel"] = "aasdsd2eWDSDSDD44";
												    }
												}
											}													     
										}
									}
								}
							}
						}						
												          
						//Fixar til CarModel.
            			//OM modell var "ED,CEE'D" (JDS552) då har ändrat den till KIA samt tar bara första SEED i ordet.
            			if(returnjson.Cardata["CarModel"] == "CEEDCEED"){
            				returnjson.Cardata["CarModel"] = "CEED";
            			}
			            //Om KIA Carens (SZS282), då måste ta bort EX och 7 från modell så stämmer mot blocket				
			            if(returnjson.Cardata["CarModel"].indexOf("CARENS") >-1){
				        	returnjson.Cardata["CarModel"] = returnjson.Cardata["CarModel"]
			            	.replace("EX","").replace(7,"").replace("ECO","")
			            	.replace("AB5ST","").replace("ICO","")
			            	.replace(/[^\w\d]/gi, '').replace(/\s/g,"");		            	
			            }
			            //Ta bort "COU" från modell.
			            if(returnjson.Cardata["CarModel"].indexOf("COU") >-1 && (returnjson.Cardata["Brand"] != "VOLVO")) {
							returnjson.Cardata["CarModel"] = returnjson.Cardata["CarModel"]
				            .replace("COU","")
				            .replace(/[^\w\d]/gi, '').replace(/\s/g,"");			            	
			            }

			            //Heter bra cross i blocket ej cross country (MMF503)
			            if(returnjson.Cardata["CarModel"].indexOf("COUNTRY") >-1 && (returnjson.Cardata["Brand"] == "VOLVO")) {
							returnjson.Cardata["CarModel"] = returnjson.Cardata["CarModel"]
				            .replace("COUNTRY","")
				            .replace(/[^\w\d]/gi, '').replace(/\s/g,"");			            	
			            }

			            //Om MAZDA6 då måste ta bort ordet MAZDA LSU778
			            if(returnjson.Cardata["CarModel"].indexOf("MAZDA6") >-1){
							returnjson.Cardata["CarModel"] = returnjson.Cardata["CarModel"]
				            .replace("MAZDA","")
				            .replace(/[^\w\d]/gi, '').replace(/\s/g,"");			            	
			            }				   			            				
			            				            					
																								  
						//console.log("Efter" + " " + returnjson.Cardata["Brand"]);	

	            		//Måste även splitta Modellår och tillverkningsår (och byta namn till CarYear och ProductionYear).
	            		if(returnjson.Cardata.hasOwnProperty("Fordonsår / Modellår")) {
	            			ProductionYear = returnjson.Cardata["Fordonsår / Modellår"].substr(0,returnjson.Cardata["Fordonsår / Modellår"].indexOf(' '));
	            			CarYear = returnjson.Cardata["Fordonsår / Modellår"].substr(returnjson.Cardata["Fordonsår / Modellår"].indexOf(' ')+1).replace(/\D/g,'');
	            			returnjson.Cardata["ProductionYear"] = Number(ProductionYear);
	            			returnjson.Cardata["CarYear"] = Number(CarYear);
	            			delete returnjson.Cardata["Fordonsår / Modellår"];
	            		}
	            		//Ändrar mätarställning så endast siffror och heter Milage
	            		if(returnjson.Cardata.hasOwnProperty("Milage")) {
	            			returnjson.Cardata["Milage"] = Number(returnjson.Cardata["Milage"].replace(/\D/g,''));
	            		}            		
	            } else{
	            	returnjson["Cardata"] = null;						
	            }

            	next(null,returnjson);
            },
            function (returnjson, next) {
            	//Ägare (Right now only check if owns more vehicles).
            	var ownerinfo = [];
            	if(fownerpresentvalue) {
            	ownerinfo = he.decode($("#owner em").html()).replace(/\s\s+/g, ' ')
            	.replace(/(<span class=\"no-break\">)/g,"").replace(/<\/span>/g,"").replace(/(det finns).*$/i,"").trim();
            	}
            	//console.log("ownerinfo: ",ownerinfo);
            	var othercars = {
            		Brand : [],
            		RegNr : [],
            		CarColor : [],									
            		CarType : [],
            		CarYear : [],
            		OwnerInfo: []
            	};	            	    			
            	if(otherscarsvalue) {
            		var ownerlink = $("div#owner.section em a.no-break").attr('href');
            		var ownerUrl = 'http://biluppgifter.se'+ownerlink;

            		function CallOwner(urllink, callback2) {
            			var ThisUserAgent = random_useragent.getRandom();	

            			request({
            				url:urllink,
            				headers: {
								'User-Agent': ThisUserAgent //Random UserAgent at each page request.
							},
							timeout: 6000,
							// The above parameters are specific to Request-retry
  							maxAttempts: 555,   // (default) try 5 times
  							retryDelay: 5000,  // (default) wait for 5s before trying again
  							retryStrategy: request.RetryStrategies.HTTPOrNetworkError // (default) retry on 5xx or network errors}
  						}, function (error, response, body) {
  							if (response) {
                				//console.log('The number of request attempts: ' + response.attempts);
                				if (error) return callback2(error);
                				var $ = cheerio.load(body);  

                				$("div.msdata a.msrow").each(function(){
                					$(this).children("div.mscol").each(function(i){
                						if(i == 0){
                							othercars["Brand"].push(he.decode($(this).html()).trim());
                						}
                						if(i == 1){
                							othercars["RegNr"].push(he.decode($(this).html()).trim());
                						}
                						if(i == 2){
                							othercars["CarColor"].push(he.decode($(this).html()).trim());
                						}
                						if(i == 3){
                							othercars["CarType"].push(he.decode($(this).html()).trim());
                						}
                						if(i == 4){
                							othercars["CarYear"].push(he.decode($(this).html()).trim());
                						}																
                					});
                				});	
                				othercars["OwnerInfo"].push(ownerinfo);							
                			}
                			returnjson["Othercarsdata"] = othercars;
                			callback2(null,returnjson);            				
                		});

					} //Close CallOwner.

					checkInternet(function(isConnected) {
						if (isConnected) {
							console.log("ConnectedAgain!");	
							CallOwner(ownerUrl, function(err, returnjson) {
								if (err) return console.log(err);
								next(null,returnjson);
							});
						} else {
							console.log("Trying to connect!");
							setTimeout(function() {
								CallOwner(ownerUrl, function(err, returnjson) {
									if (err) return console.log(err);
									next(null,returnjson);
								});
							}, 1000);
						}
					}); //End isOnline	

				} else{
					returnjson["Othercarsdata"] = othercars;
					returnjson["Othercarsdata"]["OwnerInfo"].push(ownerinfo);
					next(null,returnjson);
				}
			},
			function (returnjson, next) {
				//Historydata					
				if(fhistpresentvalue){
					var fhistvals = [];
					$("div.card.card-body.card-history section.history.enlarge div div.col").each(function(){
						var fhist = $(this).html();
						fhistvals.push(fhist);
					});	

					fhistjson = {};
					thetitle = [];
					thecontext = [];
					theptag = [];
					thespantag = [];
					besiktigadDone = false;
					ownerDone = false;
					traficDone = false;
					producedDone = false;
					for(i=0; i<=((fhistvals.length)-1); i++) {
						if(fhistvals[i].length > 1){
							fhistvals[i] = he.decode(fhistvals[i]);
							fhistvals[i].indexOf("<strong>") > -1 ? thetitle[i] = fhistvals[i].match(/<strong>(.*?)<\/strong>/g)[0].replace("<strong>","").replace("</strong>","").trim() : thetitle[i] = fhistvals[i]
							switch (thetitle[i]) {
							    case "Trafikstatus":
							        thetitle[i] = "TraficStatus";
							        break;
							    case "Ägarbyte":
							        thetitle[i] = "ChangedOwner";
							        break;
							    case "Besiktigad":
							        thetitle[i] = "Tested";
							        break;
							    case "Registrerad":
							        thetitle[i] = "Registered";
							        break;	
							    case "Förregistrerad":
							        thetitle[i] = "PreRegistered";
							        break;	
							    case "Tillverkad":
							        thetitle[i] = "Produced";
							        break;							        						        						        
							    default:
							        thetitle[i] = thetitle[i];								        
							}
							fhistvals[i].indexOf("<small>") > -1 ? thecontext[i] = fhistvals[i].match(/<small>(.*?)<\/small>/g)[0].replace("<small>","").replace("</small>","").trim() : thecontext[i] = fhistvals[i]
							fhistvals[i].indexOf("<span>") > -1 ? theptag[i] = fhistvals[i].match(/<span class="pull-right">(.*?)<\/span>/g)[0].replace('<span class="pull-right">',"").replace("</span>","").trim() : theptag[i] = fhistvals[i]
							if(theptag[i].indexOf("<span")>=0){
								theptag[i] = theptag[i].replace(/(<span class=\"no-break\">)/g,"").replace(/<\/span>/g,"");
							}
							//Lägger till så Traficstatus utan 0.
							if(!traficDone && thetitle[i].indexOf("TraficStatus") >=0){
								traficDone = true;
								fhistjson[String("Latest").concat(thetitle[i])] = thecontext[i].concat(theptag[i]);	
							}
							//Lägger till så senaste besiktigad heter BesiktigadLast istället för Besiktigad2 osv.
							if(!besiktigadDone && thetitle[i].indexOf("Tested") >=0){
								besiktigadDone = true;
								fhistjson[String("Latest").concat(thetitle[i])] = thecontext[i].concat(theptag[i]);	
							} 
							//Lägger till så senaste ägarbyte heter LatestChangedOwner.
							if(!ownerDone && thetitle[i].indexOf("ChangedOwner") >=0){
								ownerDone = true;
								fhistjson[String("Latest").concat(thetitle[i])] = thecontext[i].concat(theptag[i]);	
							} 
							//Lägger till så Tillverkad ser bra ut.
							if(!producedDone && thetitle[i].indexOf("Produced") >=0){
								producedDone = true;
								fhistjson[thetitle[i]] = thecontext[i].concat(theptag[i]);	
							} else{
								fhistjson[thetitle[i].concat(i)] = thecontext[i].concat(theptag[i]);
							}							
						}
					}
					returnjson["Historicdata"] = fhistjson;
					//Lägger till att ska ta mätarställning från senast besiktigad om mätarställning finns ej.
					if(!returnjson.Cardata.hasOwnProperty("Milage")) {
						if(returnjson.Historicdata.hasOwnProperty("BesiktigadLast")) {
						returnjson.Cardata["Milage"] = Number(returnjson.Historicdata["BesiktigadLast"]
													   .substr(returnjson.Historicdata["BesiktigadLast"].indexOf(' ')+1)
													   .substring(0,returnjson.Historicdata["BesiktigadLast"].indexOf(","))
													   .replace(/\D/g,''));
						returnjson.Cardata["Milage"] = Math.floor(returnjson.Cardata["Milage"]/1000) * 1000;
						}
					}
				} else{
					returnjson["Historicdata"] = {};						
				}
				next(null,returnjson);

			},
			function (returnjson, next) {
				//Techdata					
				if(ftechpresentvalue){
					var ftechvals = [];

					$("div.card.card-body.card-technical ul").first().find("li").each(function(){
						var ftech = $(this).html();
						ftechvals.push(ftech);
					});	

					ftechjson = {};
					thetitle = [];
					thecontext = [];

					for(i=0; i<=((ftechvals.length)-1); i++) {
						if(ftechvals[i]){
							ftechvals[i] = he.decode(ftechvals[i]);
							thetitle[i] = ftechvals[i].substr(0,ftechvals[i].indexOf("<")).trim();
							switch (thetitle[i]) {
							    case "Motorvolym":
							        thetitle[i] = "EngineVolume";
							        break;
							    case "Motoreffekt":
							        thetitle[i] = "EngineEffect";
							        break;
							    case "Toppfart":
							        thetitle[i] = "TopSpeed";
							        break;
							    case "Drivmedel":
							        thetitle[i] = "Fuel";
							        break;	
							    case "Förbrukning bl.":
							    	thetitle[i] = "Consumption";
							    	break;
							    case "Utsläpp CO2":
							    	thetitle[i] = "Co2Emission";
							    	break;
							    case "Ljudnivå körning":
							    	thetitle[i] = "SoundWhileDrive";
							    	break;
							    case "Passagerare":
							    	thetitle[i] = "Passengers";
							    	break;
							    case "Airbag passagerare":
							    	thetitle[i] = "AirbagPassengers";
							    	break;	
							    case "Draganordning":
							    	thetitle[i] = "Towing";
							    	break;								    							    	
							    default:
							        thetitle[i] = thetitle[i];								        
							}							
							thecontext[i] = ftechvals[i].match(/<span>(.*?)<\/span>/g)[0].replace("<span>","").replace("</span>","").trim();
							if(typeof(thecontext[i]) == "string"){
								if (thetitle[i] == "Co2Emission") {
									thecontext[i] = Number(thecontext[i].replace(/\D/g,''));
								} else {
								thecontext[i] = thecontext[i].toUpperCase();
								}
							}
							ftechjson[thetitle[i]] = thecontext[i];
						}
					}
					returnjson["Technicdata"] = ftechjson;

            		//Ändrar hästkrafter så att blir endast en siffra.
            		if(returnjson.Technicdata.hasOwnProperty("EngineEffect")) {
            			returnjson.Technicdata["HorsePowers"] = Number(returnjson.Technicdata["EngineEffect"]
            				.substr(0,returnjson.Technicdata["EngineEffect"].indexOf(' ')).replace(/\D/g,''));
            			returnjson.Technicdata["Kw"] = Number(returnjson.Technicdata["EngineEffect"]
            				.substr(returnjson.Technicdata["EngineEffect"].indexOf(' ')+1,
            					    returnjson.Technicdata["EngineEffect"].length).replace(/\D/g,''));              			
            			delete returnjson.Technicdata["EngineEffect"];
            		}
            		//Ändrar Drivmedel så att heter fuel.
            		if(returnjson.Technicdata.hasOwnProperty("Fuel")) {
            			//Ändrar så att hybrid drivmedel blir rätt utifrån blockets data
            			//console.log(returnjson.Technicdata["Drivmedel"].replace(/\s/g, ""));
            			if(returnjson.Technicdata["Fuel"].replace(/\s/g, "") == "BENSIN") {
            				returnjson.Technicdata["Fuel"] = "BENSIN";
            			} else{
             				if(returnjson.Technicdata["Fuel"].replace(/\s/g, "") == "DIESEL") {
            					returnjson.Technicdata["Fuel"] = "DIESEL";
            				} else{
            					returnjson.Technicdata["Fuel"] = "MILJÖBRÄNSLE/HYBRID";
            				}
            			}         			
            		}
            		
            		//Ändrar Växellåda så att heter Gear.
            		if(returnjson.Technicdata.hasOwnProperty("Växellåda")) {
	            		if(returnjson.Technicdata["Växellåda"] != "MANUELL"){
							returnjson.Technicdata["Gear"] = "AUTOMAT";
							delete returnjson.Technicdata["Växellåda"];
						} else {
							returnjson.Technicdata["Gear"] = "MANUELL";
							delete returnjson.Technicdata["Växellåda"];						
						}
					}	

            		//Ändrar Fyrhjulsdrift, om "nej" då "Tvåhjulsdriven", om "ja" då "Fyrhjulsdriven".
            		if(returnjson.Technicdata.hasOwnProperty("Fyrhjulsdrift")) {
            			if(returnjson.Technicdata["Fyrhjulsdrift"] == "NEJ"){
            				returnjson.Technicdata["DriveGear"] = "TVÅHJULSDRIVEN";
            				delete returnjson.Technicdata["Fyrhjulsdrift"];							
            			} else{
            				returnjson.Technicdata["DriveGear"] = "FYRHJULSDRIVEN";
            				delete returnjson.Technicdata["Fyrhjulsdrift"];	
            			}

            		}            		

            	} else{
            		returnjson["Technicdata"] = {};						
            	}

            	next(null,returnjson);

            },
            function (returnjson, next) {
				//Dimensions					
				if(fdimpresentvalue){
					var fdimvals = [];

					$("div.card.card-body.card-technical ul").eq(1).find("li").each(function(){
						var fdim = $(this).html();
						fdimvals.push(fdim);
					});	

					fdimjson = {};
					thetitle = [];
					thecontext = [];

					for(i=0; i<=((fdimvals.length)-1); i++) {
						if(fdimvals[i]){
							fdimvals[i] = he.decode(fdimvals[i]);
							thetitle[i] = fdimvals[i].substr(0,fdimvals[i].indexOf("<")).trim();
							switch (thetitle[i]) {
							    case "Längd":
							        thetitle[i] = "Length";
							        break;
							    case "Bredd":
							        thetitle[i] = "Width";
							        break;
							    case "Höjd":
							        thetitle[i] = "Heigth";
							        break;
							    case "Tjänstevikt":
							        thetitle[i] = "Weigth";
							        break;	
							    case "Totalvikt":
							    	thetitle[i] = "TotalWeigth";
							    	break;
							    case "Lastvikt":
							    	thetitle[i] = "CarryingWeigth";
							    	break;
							    case "Släpvagnsvikt":
							    	thetitle[i] = "TrailerWeigth";
							    	break;
							    case "Släpvagnsvikt obromsad":
							    	thetitle[i] = "TrailerWeigthNoBrakes";
							    	break;
							    case "Släp totalvikt (B)":
							    	thetitle[i] = "TrailerTotalWeigthB";
							    	break;	
							    case "Kärra, maxvikt":
							    	thetitle[i] = "KarraTotalWeigth";
							    	break;
							    case "Släp totalvikt (B+)":
							    	thetitle[i] = "TrailerTotalWeigthBplus";
							    	break;								    	
							    case "Däck fram":
							    	thetitle[i] = "TiresFront";
							    	break;	
							    case "Däck bak":
							    	thetitle[i] = "TiresBack";
							    	break;	
							    case "Fälg fram":
							    	thetitle[i] = "RimFront";
							    	break;	
							    case "Fälg bak":
							    	thetitle[i] = "RimBack";
							    	break;
					    		case "Axelavstånd":
							    	thetitle[i] = "WidthBetweenAxes";
							    	break;							    	
							    case "Färg":
							    	thetitle[i] = "CarColor";
							    	break;	
							    case "Kaross":
							    	thetitle[i] = "CarType";
							    	break;								    								    								    							    	
							    default:
							        thetitle[i] = thetitle[i];								        
							}							
							thecontext[i] = fdimvals[i].match(/<span>(.*?)<\/span>/g)[0].replace("<span>","").replace("</span>","").trim();
							if(typeof(thecontext[i]) == "string"){
								thecontext[i] = thecontext[i].toUpperCase();
							}
							fdimjson[thetitle[i]] = thecontext[i];
						}
					}
					returnjson["Dimensionsdata"] = fdimjson;          		
            	} else{
            		returnjson["Dimensionsdata"] = {};						
            	}	
            	next(null,returnjson);

            },
            function (returnjson, next) {
				//Övrigt					
				if(fothpresentvalue){
					var fothvals = [];

					$("div.card.card-body.card-technical ul").eq(2).find("li").each(function(){
						var foth = $(this).html();
						fothvals.push(foth);
					});	

					fothjson = {};
					thetitle = [];
					thecontext = [];

					for(i=0; i<=((fothvals.length)-1); i++) {
						if(fothvals[i]){
							fothvals[i] = he.decode(fothvals[i]);
							thetitle[i] = fothvals[i].substr(0,fothvals[i].indexOf("<")).trim();
							switch (thetitle[i]) {
							    case "Fordonskategori EU":
							        thetitle[i] = "VehicleCategoryEU";
							        break;
							    case "Typgodkännandenr.":
							        thetitle[i] = "TypeClearanceNumber";
							        break;
							    case "Kväveoxider, NOX":
							        thetitle[i] = "NOX";
							        break;
							    case "Kolväten+kväveoxider, THC+NOX":
							        thetitle[i] = "THCNOX";
							        break;							    
							    default:
							        thetitle[i] = thetitle[i];								        
							}							
							thecontext[i] = fothvals[i].match(/<span>(.*?)<\/span>/g)[0].replace("<span>","").replace("</span>","").trim();
							if(typeof(thecontext[i]) == "string"){
								thecontext[i] = thecontext[i].toUpperCase();
							}
							fothjson[thetitle[i]] = thecontext[i];
						}
					}
					returnjson["Otherdata"] = fothjson;
				} else{
					returnjson["Otherdata"] = {};						
				}	
				next(null,returnjson);

			}						
			], function () {													
				resolve(null,returnjson); //one-level up callback needs to be here.
				}); //closing async.waterfall. 
}
			}); //closing request.
})
}

module.exports = router


