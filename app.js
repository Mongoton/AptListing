
/**
 * Module dependencies.
 */

var express = require('express')
    ,app = module.exports = express.createServer()
    ,mongo = require('mongodb')
    ,monk = require('monk')
    ,db = monk('localhost:27017/test')
    ,street = require('./street')
    ,async = require("async")
    ,cheerio = require("cheerio");
// Configuration

app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

// Routes
app.get('/', function(req, res){
    res.render('simpleQuery',{"title": "Listing", "list":""} )
});

app.post('/simpleQuery', function(req, res){

    var area= req.body.area;

    var price_from = req.body.price_from;
    var price_to = req.body.price_to;
    var beds = req.body.beds;
    var baths = req.body.baths;
    var page = req.body.page;
    if(page == undefined) page=1;
    else {
        if(page<=0) page=1;
    }
    var listCount=req.body.listCount;
    if(listCount==undefined){
        listCount=1
    }


    var query="http://streeteasy.com/for-rent/"+area+"/";
    if(price_from.length>0 || price_to.length>0){
        query=query+"price:";
        if(price_from.length>0)
            query = query+1*price_from;
        if(price_to.length>0)
            query = query+"-"+price_to*1;
    }
    if(beds.length>0)
        query=query+"%7Cbeds:"+beds;
    if(baths.length>0)
        query=query+"%7baths"+baths;

    if(page>1)
        query=query+"?page="+page;


    street.download(query, function(data){
        if (data) {

            var $ = cheerio.load(data);
            $('.criteria_count').each(function(){
                var numResults = $(this).text();
                console.log(numResults);
                if(parseInt(numResults==0)){
                    console.log("Found 0 results, trying to render")
                    res.render('list', {
                        "list" : new Array(),
                        "title": "No Result found",
                        "count": 0

                    });
                }
                if(parseInt(numResults) >0){
                    async.series({

                            address: function(callback){

                                var address = new Array();
                                var count=0;
                                $('.details_title').each(function(){

                                    //console.log($(this).find('h5 a').text().trim());
                                    address[count]=$(this).find('h5 a').text().trim();
                                    count++;
                                });
                                callback(null, address)
                            },
                            details: function(callback){
                                console.log("******"+req.body.price_from);
                                var details;
                                var prices = new Array();
                                var firstDetails = new Array();
                                var sndDetails = new Array();
                                var last =new Array();

                                var count=0;
                                $('.details_info').each(function(){
                                    // console.log("******************************");
                                    // console.log($(this).text().trim());
                                    //console.log($(this).find('.price').text().trim());
                                    //console.log($(this).find('.first_detail_cell').text().trim());
                                    //console.log($(this).find('.detail_cell').text().trim());
                                    //console.log($(this).find('.last_detail_cell').text().trim());
                                    try{
                                        if( $(this).text().trim()!= undefined && $(this).text().trim()!='')
                                            details+=($(this).text().trim());

                                        if(  $(this).find('.price').text().trim()!='' ){
                                            prices.push( $(this).find('.price').text().trim());
                                        }
//                                    if ($(this).find('.first_detail_cell').text().trim()!=''){
//                                        firstDetails.push($(this).find('.first_detail_cell').text().trim());
//                                    }
//                                    if ($(this).find('.detail_cell').text().trim()!=''){
//                                        sndDetails.push($(this).find('.detail_cell').text().trim());
//                                    }
//                                    if ($(this).find('.last_detail_cell').text().trim()!=''){
//                                        last.push((this).find('.last_detail_cell').text().trim());
//                                    }
                                    }
                                    catch(err){
                                        console.log(err);
                                    }

                                    count++;

                                });
                                callback(null,
                                    {    'count': numResults,
                                        'price' :prices,
                                        'first': firstDetails,
                                        'second': sndDetails,
                                        'last':last,
                                        'all': details,
                                        'test': req.body.price_from,
                                        'res': res,
                                        'total': (parseInt(numResults.replace(",",""))+1),
                                        'area' :area,
                                        'price_from': price_from,
                                        'price_to': price_to,
                                        'beds': beds,
                                        'baths': baths,
                                        'page':page

                                    })

                            }
                        },
                        function(err, results){
                            if(!err){


                                var separated = results.details.all.split('$');
                                separated.splice(0,1);
                                console.log(separated);
                                var list=new Array();
                                for(var i=0; i<results.address.length; i++){
                                    var pretty = "$"+separated[i].replace("for rent","")
                                        .replace("bed", "bed,").replace("bath", "bath,")
                                        .replace(/,s/g, "s,").replace("Furnished", "Furnished,")
                                        .replace("ft²","ft²,").replace("Rental", " Rental")
                                        .replace("Condo", " Condo").replace("Listed", "  Listed");

                                    list.push(
                                        {'address': results.address[i],
                                            'detail': pretty
                                        }
                                    )
                                }

                                var count_from = (parseInt(listCount));
                                var count =(list.length+parseInt(listCount)-1);
                                if(count>results.details.total){
                                    count=results.details.total;
                                    count_from= results.details.total-list.length;

                                }
                                //results.details.res.redirect('/simpleList');
                                    res.render('list', {
                                        "list" : list,
                                        "title": "Address List",
                                        "count_from": count_from,
                                        "count": count,
                                        "total": results.details.total,
                                        'area' :results.details.area,
                                        'price_from': results.details.price_from,
                                        'price_to': results.details.price_to,
                                        'beds': results.details.beds,
                                        'baths': results.details.baths,
                                        'page':results.details.page,
                                        'listCount':count


                                    });


                            }

                        });
                }
            })}

        else console.log("error");


    });
});

app.get('/simpleList', function( req,res){


    //console.log(e);
    //console.log(docs);

    res.render('list', {
        "list" : docs,
        "title": "Address List",
        "count": docs.length

    });
});





app.listen(3000, function(){
    console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
