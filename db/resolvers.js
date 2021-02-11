const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
    //console.log(usuario);
    const { id, nombre, email, apellido } = usuario;
    return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

//resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async (_, { }, ctx) => {
            return ctx.usuario;
        },
        obtenerProductos: async () => {
            try {
                const productos = await Producto.find({});
                return productos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerProducto: async (_, { id }) => {
            // revisar si el producto existe o no
            const producto = await Producto.findById(id);
            if (!producto) {
                throw new Error("Producto no encontrado");
            }

            return producto;
        },
        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find({});
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerClientesVendedor: async (_, {}, ctx) => {
            console.log(ctx.usuario.id.toString());
            try {
                const clientes = await Cliente.find({
                    vendedor: ctx.usuario.id.toString(),
                });
                console.log("clientes");
                console.log(clientes);
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerCliente: async (_, { id }, ctx) => {
            //revisar si el cliente existe o no
            const cliente = await Cliente.findById({ _id: id });
            if (!cliente) {
                throw new Error("Cliente no encontrado");
            }

            //quien lo creo puede verlo

            if (cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error("No tienes las credenciales");
            }

            return cliente;
        },

        //Pedidos
        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedidosVendedor: async (_, {}, ctx) => {
            try {
                const pedidos = await Pedido.find({ vendedor: ctx.usuario.id });
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedido: async (_, { id }, ctx) => {
            //ver si el pedido existe o no
            const pedido = await Pedido.findById({ _id: id });
            if (!pedido) {
                throw new Error("Pedido no encontrado");
            }

            //ver quien lo creo
            if (pedido.vendedor.toString() !== ctx.usuario.id) {
                throw new Error("No tienes las credenciales");
            }

            //retornar el resultado
            return pedido;
        },
        obtenerPedidosEstado: async (_,{ estado }, ctx) => {
            const pedidos = await Pedido.find({vendedor: ctx.usuario.id, estado });
            return pedidos;
        },
        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                { $match : { estado: "COMPLETADO"}},
                {$group: {
                    _id: "$cliente",
                    total: { $sum: '$total'}
                }},
                {
                   $lookup: {
                       from: 'clientes',
                       localField: '_id',
                       foreignField: "_id",
                       as: "cliente"
                   }
                },
                {
                    $limit: 10
                },
                {
                    $sort : {total : -1}
                }
            ]);
            return clientes;
        },
        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                { $match : { estado: "COMPLETADO"}},
                {$group: {
                    _id: "$vendedor",
                    total: { $sum: '$total'}
                }},
                {
                   $lookup: {
                       from: 'usuarios',
                       localField: '_id',
                       foreignField: "_id",
                       as: "vendedor"
                   }
                },
                {
                    $limit: 3
                },
                {
                    $sort : {total : -1}
                }
            ]);
            return vendedores;

        },

        buscarProducto: async (_, {texto}) => {
            const productos = await Producto.find({$text: {$search: texto}}).limit(10);
            return productos;
        }
    },
    Mutation: {
        nuevoUsuario: async (_, { input }) => {
            const { email, password } = input;

            //revisar si el usuario esta registrado
            const existeUsuario = await Usuario.findOne({ email });
            if (existeUsuario) {
                throw new Error("El usuario ya esta registrado");
            }

            //hashear el password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            try {
                // guardar en la base de datos
                const usuario = new Usuario(input);
                usuario.save();
                return usuario;
            } catch (error) {
                console.log(error);
            }
        },

        autenticarUsuario: async (_, { input }) => {
            try {
                const { email, password } = input;
                // si el usuario existe
                const existeUsuario = await Usuario.findOne({ email });
                if (!existeUsuario) {
                    throw new Error("El usuario no existe");
                }
                console.log(existeUsuario.email);
                // revisar si el password es correcto
                const passwordCorrecto = await bcryptjs.compare(
                    password,
                    existeUsuario.password
                );

                if (!passwordCorrecto) {
                    throw new Error("El password es incorrecto");
                }

                // crear el token
                return {
                    token: crearToken(
                        existeUsuario,
                        process.env.SECRETA,
                        "24h"
                    ),
                };
            } catch (error) {
                console.log("salto el try");
                console.log(error);
                throw new Error(error);
            }
        },

        nuevoProducto: async (_, { input }) => {
            try {
                console.log("input");
                console.log(input);
                const nuevoProducto = new Producto(input);
                // almacenar en la base de datos
                const resultado = await nuevoProducto.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarProducto: async (_, { id, input }) => {
            // revisar si el producto existe o no
            let producto = await Producto.findById(id);

            if (!producto) {
                throw new Error("Producto no encontrado");
            }

            //guardar en la base de datos
            producto = await Producto.findOneAndUpdate({ _id: id }, input, {
                new: true,
            });
            return producto;
        },
        eliminarProducto: async (_, { id }) => {
            // revisar si el producto existe o no
            let producto = await Producto.findById(id);

            if (!producto) {
                throw new Error("Producto no encontrado");
            }

            //eliminar
            await Producto.findOneAndDelete({ _id: id });
            return "Producto Eliminado";
        },

        //Clientes

        nuevoCliente: async (_, { input }, ctx) => {
            const { email } = input;
            // revisar si el cliente existe o no
            //console.log(input);
            let cliente = await Cliente.findOne({ email });

            if (cliente) {
                throw new Error("Cliente ya registrado");
            }
            const nuevoCliente = new Cliente(input);
            //asignar venededor
            nuevoCliente.vendedor = ctx.usuario.id;

            try {
                //guardar en la base de datos

                const resultado = await nuevoCliente.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarCliente: async (_, { id, input }, ctx) => {
            // verificar si existe o no
            let cliente = await Cliente.findById(id);

            if (!cliente) {
                throw new Error("Ese cliente no existe");
            }

            //verificar si es el vendedor quien edita
            if (cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error("No tienes las credenciales");
            }

            //guardar el cliente
            cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
                new: true,
            });
            return cliente;
        },
        eliminarCliente: async (_, { id }, ctx) => {
            // verificar si existe o no
            let cliente = await Cliente.findById(id);

            if (!cliente) {
                throw new Error("Ese cliente no existe");
            }

            //verificar si es el vendedor quien edita
            if (cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error("No tienes las credenciales");
            }

            //eliminar el cliente
            await Cliente.findOneAndDelete({ _id: id });
            return "Cliente Eliminado";
        },

        // Pedidos
        nuevoPedido: async (_, { input }, ctx) => {
            const { cliente } = input;
            //verificar si el cliente existe o no
            let clienteExiste = await Cliente.findById(cliente);

            if (!clienteExiste) {
                throw new Error("Ese cliente no existe");
            }

            //verificar si el cliente es del vendedor

            if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
                throw new Error("No tienes las credenciales");
            }

            //revisar que el stock este disponible

            for await (const articulo of input.pedido) {
                const { id } = articulo;
                const producto = await Producto.findById(id);
                console.log(producto);
                if (articulo.cantidad > producto.existencia) {
                    throw new Error(
                        `El articulo: ${producto.nombre} excede la cantidad disponible`
                    );
                } else {
                    //restar la cantidad a lo disponible
                    producto.existencia =
                        producto.existencia - articulo.cantidad;
                    await producto.save();
                }
            }
            //crear un nuevo pedido
            const nuevoPedido = new Pedido(input);

            //asignarle un vendedor
            nuevoPedido.vendedor = ctx.usuario.id;

            //guardar en base de datos
            const resultado = await nuevoPedido.save();
            return resultado;
        },

        actualizarPedido: async (_, { id, input }, ctx) => {
            
                const { cliente } = input;
                //si existe el pedido
                const existePedido = await Pedido.findById({ _id  : id});
                if (!existePedido) {
                    throw new Error("El pedido no existe");
                }

                //existe el cliente
                const existeCliente = await Cliente.findById({ _id: cliente });
                if (!existeCliente) {
                    throw new Error("El Cliente no existe");
                }

                //cliente y pedido pertenece al vendedor

                if (existeCliente.vendedor.toString() !== ctx.usuario.id) {
                    throw new Error("No tienes las credenciales");
                }

                //revisar el stock
                if(input.pedido){
                    for await (const articulo of input.pedido) {
                        const { id } = articulo;
                        const producto = await Producto.findById({ _id: id });
                        console.log(producto);
                        if (articulo.cantidad > producto.existencia) {
                            throw new Error(
                                `El articulo: ${producto.nombre} excede la cantidad disponible`
                            );
                        } else {
                            //restar la cantidad a lo disponible
                            producto.existencia =
                                producto.existencia - articulo.cantidad;
                            await producto.save();
                        }
                    }
                }
                

                //guardar el pedido
                const resultado = await Pedido.findOneAndUpdate(
                    { _id: id },
                    input,
                    { new: true }
                );
                return resultado;
            
        },
        eliminarPedido: async (_, {id}, ctx) =>{
            //verificamos si el pedido existe
            const existePedido = await Pedido.findById({ _id  : id});
            if (!existePedido) {
                throw new Error("El pedido no existe");
            }


            //verificar si el vendedor es el que lo borra
            if (existePedido.vendedor.toString() !== ctx.usuario.id) {
                throw new Error("No tienes las credenciales");
            }

            //eliminar de la base de datos
            await Pedido.findOneAndDelete({_id :id});
            return "Pedido Eliminado";
        }
    },
};

module.exports = resolvers;
