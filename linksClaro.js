const Nightmare = require('nightmare');
const fs = require('fs');
const vo = require('vo');

const ceps = fs.readFileSync('ceps.txt', 'utf-8').split('\n');
const urlCep = 'https://lojaonline.claro.com.br/change-price-group';
fs.writeFileSync('linksClaro.txt', '', function () { console.log('Arquivo limpo.') });

var run = function * (){
	let list = []
	try{
		
		for(let cep of ceps){
			console.log("Cep: " + cep);
			var nightmare = new Nightmare({show: false, gotoTimeout: 999999999, waitTimeout: 999999999});
			yield nightmare.goto(urlCep)
                        .wait('#edit-cep-part1')
                        .insert('#edit-cep-part1', cep)
                        .click('#edit-submit')
						.wait(10000);
		
			var previousHeight, currentHeight=0;
			while(previousHeight !== currentHeight) {
			    previousHeight = currentHeight;
			    var currentHeight = yield nightmare.evaluate(function() {
			      return document.body.scrollHeight;
			    });
			    yield nightmare.scrollTo(currentHeight, 0)
			      .wait(10000);
			}
			var links = yield nightmare.evaluate(function(){
	            return Array.from(document.querySelectorAll('.offer')).map(element => element.href);           
			});			
			
			yield nightmare.end();
			list = list.concat(cep);
			list = list.concat(links);	
			console.log(links)
		}
	}catch(e){
		console.log(e);
	}
	return list;
}


vo(run)(async function(err, result){	
	var file = fs.createWriteStream('linksClaro.txt', {flags: 'a'});
	for(let obj of result){
		file.write(obj + '\r\n');
	}		
	file.end();
});


Array.prototype.unique = function () {
    var a = this.concat();
    for (var i = 0; i < a.length; ++i) {
        for (var j = i + 1; j < a.length; ++j) {
            if (a[i] === a[j])
                a.splice(j--, 1);
        }
    }

    return a;
};





