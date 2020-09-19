const Nightmare = require('nightmare');
const fs = require('fs');
const sql = require('mssql');
const watch = 'watch';
const urlCep = 'https://lojaonline.claro.com.br/change-price-group';
var links = recuperarLinks();

function recuperarLinks() {
    var links = fs.readFileSync('linksClaro.txt', 'utf-8').split('\r\n');
    var indices = [];
    var objs = [];
    for (var i = 0; i < links.length; i++) {
        if (links[i].length == 9 || links[i].length == 8) {
            indices.push(i);
        }
    }
    for (var i = 0; i < indices.length; i++) {
        var obj = {}
        obj.cep = links[indices[i]];
        obj.links = [];
        if (i == indices.length - 1) {
            for (var j = indices[i] + 1; j < links.length; j++) {
                if (links[j] != '' && !links[j].includes(watch)) {
                    obj.links.push(links[j]);
                }
            }
        } else {
            for (var j = indices[i] + 1; j < indices[i + 1]; j++) {
                if (links[j] != '' && !links[j].includes(watch)) {
                    obj.links.push(links[j]);
                }
            }
        }
        objs.push(obj);
    }
    return objs;
}

async function recuperarPrecosClaro() {
    for (let obj of links) {
        for (let url of obj.links) {
            try {
                if (url != '' && url != '\r') {
                    console.log("Cep: " + obj.cep);
                    console.log("Link: " + url);

                    var nightmare = new Nightmare({ show: false, gotoTimeout: 999999999, waitTimeout: 999999999 });

                    let result = await nightmare.goto(urlCep)
                        .wait('#edit-cep-part1')
                        .insert('#edit-cep-part1', obj.cep)
                        .click('#edit-submit')
						.wait(10000)
						.goto(url)
						.wait(15000)
						.click('#arrow-icon')
						.evaluate(function () {
                            var obj = {
                                aparelho: Array.from(document.querySelectorAll('.product-title')).map(element => element.innerText),
                                dados: Array.from(document.querySelectorAll('.plan')).map(element => element.innerText)
                            }
                            return obj;
                        }).end();
                    var dadosAjustados = montarDadosClaro(result.aparelho, result.dados, obj.cep);					
                    await Promise.all(dadosAjustados.map(obj => salvarBanco(obj)));
                }
            } catch (e) {
                console.log(e);
            }
        }
    }
}

async function salvarBanco(dados) {
    const pool = new sql.ConnectionPool({
	  user: 'RegionalNE',
	  password: 'RegionalNEvivo2019',
	  server: '10.238.176.136',  
	  database: 'SOL'
	});
    pool.connect().then(function () {
        const request = new sql.Request(pool);
        const insert = "insert into [SOL].[dbo].[PRECOS_CONCORRENCIA_CLARO_AUX] ([APARELHO], [PRECO_APARELHO], [PLANO], [PRECO_PLANO], [UF], [CEP], [DATA_CARGA]) " +
            " values ('" + dados.aparelho + "', '" + dados.precoAparelho + "', '" + dados.plano + "', '" + dados.precoPlano + "', '" + dados.uf + "','" + dados.cep + "',convert(date, getdate(),101))";
        request.query(insert).then(function (recordset) {
            console.log('Dado inserido');
            pool.close();
        }).catch(function (err) {
            console.log(err);
            pool.close();
        })
    }).catch(function (err) {
        console.log(err);
    });
}


async function excluirBanco() {
    const pool = new sql.ConnectionPool({
	  user: 'RegionalNE',
	  password: 'RegionalNEvivo2019',
	  server: '10.238.176.136',  
	  database: 'SOL'
	});
    pool.connect().then(function () {
        const request = new sql.Request(pool);
        const del = "DELETE FROM [SOL].[dbo].[PRECOS_CONCORRENCIA_CLARO_AUX]";
        request.query(del).then(function (recordset) {
            console.log('Dados removidos');
            pool.close();
        }).catch(function (err) {
            console.log(err);
            pool.close();
        })
    }).catch(function (err) {
        console.log(err);
    });
}

function montarDadosClaro(aparelho, planos, cep) {
    var dadosAjustados = [];

    for (let plano of planos) {
        var obj = {};        
        obj.aparelho = aparelho[0].replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ')
			.replace('SAMSUNG SAMSUNG', 'SAMSUNG')
			.replace("NOTE9", "NOTE 9")
			.replace(" 4.5G", "")
			.replace("ZTE ZTE", "ZTE")
			.replace("SONY SONY", "SONY")
			.replace("LG LG", "LG")
			.replace("MOTOROLA MOTO", "MOTO")
			.replace("LENOVO LENOVO", "LENOVO").trim();		
        var array = plano.replace(/(\r\n\t|\n|\r\t)/gm, ",").replace(/\s\s+/g, ' ').replace(/,+/g, ',').split(',');
        console.log(array);
        console.log(array.length);
        if (array.length == 12) {
            obj.plano = array[0];
            obj.precoPlano = array[2] + ',' + array[3];
            obj.precoAparelho = array[6] + ',' + array[7] + ' - ' + array[8] + ',' + array[9];
			obj.cep = cep.trim().replace('\r\n', '').replace('\r', '').replace('\n', '');
	        if (cep.includes('60170250')) {
	            obj.uf = 'CE';
	        } else if (cep.includes('45600760')) {
	            obj.uf = 'BA';
	        } else if (cep.includes('51011051')){
	            obj.uf = 'PE'
	        }
			dadosAjustados.push(obj);	
        } else if (array.length == 15) {
            obj.plano = array[0];
            obj.precoPlano = array[5] + ',' + array[6];
            obj.precoAparelho = array[9] + ',' + array[10] + ' - ' + array[11] + ',' + array[12];
			obj.cep = cep.trim().replace('\r\n', '').replace('\r', '').replace('\n', '');
	        if (cep.includes('60170250')) {
	            obj.uf = 'CE';
	        } else if (cep.includes('45600760')) {
	            obj.uf = 'BA';
	        } else if (cep.includes('51011051')){
	            obj.uf = 'PE'
	        }
			dadosAjustados.push(obj);	
        } else if (array.length == 16) {
            obj.plano = array[0];
            obj.precoPlano = array[6] + ',' + array[7];
            obj.precoAparelho = array[10] + ',' + array[11] + " - " + array[12] + ',' + array[13];
			obj.cep = cep.trim().replace('\r\n', '').replace('\r', '').replace('\n', '');
	        if (cep.includes('60170250')) {
	            obj.uf = 'CE';
	        } else if (cep.includes('45600760')) {
	            obj.uf = 'BA';
	        } else if (cep.includes('51011051')){
	            obj.uf = 'PE'
	        }
			dadosAjustados.push(obj);	
        } else if (array.length == 24){
			obj.plano = array[0];
            obj.precoPlano = array[14] + ',' + array[15];
            obj.precoAparelho = array[18] + ',' + array[19] + " - " + array[20] + ',' + array[21];
			obj.cep = cep.trim().replace('\r\n', '').replace('\r', '').replace('\n', '');
	        if (cep.includes('60170250')) {
	            obj.uf = 'CE';
	        } else if (cep.includes('45600760')) {
	            obj.uf = 'BA';
	        } else if (cep.includes('51011051')){
	            obj.uf = 'PE'
	        }
			dadosAjustados.push(obj);	
		} else if (array.length == 25){
			obj.plano = array[0];
            obj.precoPlano = array[15] + ',' + array[16];
            obj.precoAparelho = array[19] + ',' + array[20] + " - " + array[21] + ',' + array[22];
			obj.cep = cep.trim().replace('\r\n', '').replace('\r', '').replace('\n', '');
	        if (cep.includes('60170250')) {
	            obj.uf = 'CE';
	        } else if (cep.includes('45600760')) {
	            obj.uf = 'BA';
	        } else if (cep.includes('51011051')){
	            obj.uf = 'PE'
	        }
			dadosAjustados.push(obj);	
		} else if (array.length == 17){
			obj.plano = array[0];
            obj.precoPlano = array[7] + ',' + array[8];
            obj.precoAparelho = array[11] + ',' + array[12] + " - " + array[13] + ',' + array[14];
			obj.cep = cep.trim().replace('\r\n', '').replace('\r', '').replace('\n', '');
	        if (cep.includes('60170250')) {
	            obj.uf = 'CE';
	        } else if (cep.includes('45600760')) {
	            obj.uf = 'BA';
	        } else if (cep.includes('51011051')){
	            obj.uf = 'PE'
	        }
			dadosAjustados.push(obj);			
       
		} else if (array.length == 18){
			obj.plano = array[0];
            obj.precoPlano = array[8] + ',' + array[9];
            obj.precoAparelho = array[12] + ',' + array[13] + " - " + array[14] + ',' + array[15];
			obj.cep = cep.trim().replace('\r\n', '').replace('\r', '').replace('\n', '');
	        if (cep.includes('60170250')) {
	            obj.uf = 'CE';
	        } else if (cep.includes('45600760')) {
	            obj.uf = 'BA';
	        } else if (cep.includes('51011051')){
	            obj.uf = 'PE'
	        }
			dadosAjustados.push(obj);	
		}
    }
    console.log(dadosAjustados);
    return dadosAjustados;
}

recuperarPrecosClaro();