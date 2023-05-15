const serialport = require('serialport');
const express = require('express');
const mysql = require('mysql2');

const SERIAL_BAUD_RATE = 9600;
const SERVIDOR_PORTA = 3000;
const HABILITAR_OPERACAO_INSERIR = true;

var idLimite = 1;
var idLocal = 1;
var contador = 1;

const serial = async (
    valoresDht11Umidade,
    valoresMediaTemperatura
) => {
    const poolBancoDados = mysql.createPool(
        {
            host: 'localhost',
            port: 3306,
            user: 'User_DataQuino',
            password: '@secureSHIP',
            database: 'Secure_Ship'
        }
    ).promise();

    const portas = await serialport.SerialPort.list();
    const portaArduino = portas.find((porta) => porta.vendorId == 2341 && porta.productId == 43);
    if (!portaArduino) {
        throw new Error('O arduino não foi encontrado em nenhuma porta serial');
    }
    const arduino = new serialport.SerialPort(
        {
            path: portaArduino.path,
            baudRate: SERIAL_BAUD_RATE
        }
    );
    arduino.on('open', () => {
        console.log(`A leitura do arduino foi iniciada na porta ${portaArduino.path} utilizando Baud Rate de ${SERIAL_BAUD_RATE}`);
    });
    arduino.pipe(new serialport.ReadlineParser({ delimiter: '\r\n' })).on('data', async (data) => {
        const valores = data.split(';');
        const dht11Umidade = parseFloat(valores[0]);
        const mediaTemp = parseFloat(valores[1]);
        // const luminosidade = parseFloat(valores[2]);
        // const chave = parseInt(valores[3]);

        valoresDht11Umidade.push(dht11Umidade);
        valoresMediaTemperatura.push(mediaTemp);
        // valoresLuminosidade.push(luminosidade);
        // valoresChave.push(chave);

        if (HABILITAR_OPERACAO_INSERIR) {
            contador++;
            await poolBancoDados.execute(
                'INSERT INTO Leitura (Leitura_temp, Leitura_Umi, FKLocal_LE, FKLimite_LE) VALUES (?,?,?,?)',
                [mediaTemp, dht11Umidade, idLocal, idLimite],
            );

            if (contador % 2 == 0){
                idLimite = 2;
            }else {
                idLimite = 1;
            }

            if (contador <= 10 ) {
                idLocal = 1;
            }else if (contador <= 20) {
                idLocal = 2;
            }else if (contador <= 30) {
                idLocal = 3;
                
            }else if (contador <= 40) {
                idLocal = 4;
            }
            
        }
           

    });
    arduino.on('error', (mensagem) => {
        console.error(`Erro no arduino (Mensagem: ${mensagem}`)
    });
}

const servidor = (
    valoresDht11Umidade,
    valoresMediaTemperatura,
) => {
    const app = express();
    app.use((request, response, next) => {
        response.header('Access-Control-Allow-Origin', '*');
        response.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
        next();
    });
    app.listen(SERVIDOR_PORTA, () => {
        console.log(`API executada com sucesso na porta ${SERVIDOR_PORTA}`);
    });
    app.get('/sensores/dht11/umidade', (_, response) => {
        return response.json(valoresDht11Umidade);
    });
    app.get('/sensores/MediaTemperatura', (_, response) => {
        return response.json(valoresMediaTemperatura);
    });
}

(async () => {
    const valoresDht11Umidade = [];
    const valoresMediaTemperatura = [];
    await serial(
        valoresDht11Umidade,
        valoresMediaTemperatura
    );
    servidor(
        valoresDht11Umidade,
        valoresMediaTemperatura
    );
})();
