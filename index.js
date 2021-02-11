const { ApolloServer, gql } = require("apollo-server");
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const conectarDB = require('./config/db');
const jwt = require('jsonwebtoken');
require ('dotenv').config({path: 'variables.env'});

//conectar la base de datos
conectarDB();



//servidor
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({req}) =>{
        // console.log(req.headers['authorization']);
        //console.log(req.headers);
        const token = req.headers['authorization'] || '';
        if(token){
            try {
                const usuario = await jwt.verify(token.replace('Bearer ',''), process.env.SECRETA);

                //console.log(usuario);
                return{
                    usuario
                }

            } catch (error) {
                console.log('Hubo un errror');
                console.log(error);
            }
        }
    }

});

//arrancar el servidor
server.listen().then(({ url }) => {
    console.log(`Servidor listo en la  URL ${url}`);
});
