import bcrypt from 'bcrypt';
import pool from '../db/pool.js';

export const register = async(req,res) => {
    const { username, email, password, full_name} = req.body;
    
    if (!username ||!email ||!password||!full_name){
        return res.status(400).json({
            error:'All fields (username,email,password,full_name) are required'
        });
    }

    const client = await pool.connect();//holding the same runner for multiple queries

    try{
        const saltrounds = 10;
        const password_hash = await bcrypt.hash(password,saltrounds);//hash password(salt rounds = 10)
        
        await client.query('BEGIN');//start database connection

        const userQuery = `INSERT INTO users(username,email,password_hash) 
        VALUES ($1, $2, $3)
        RETURNING user_id,username,email,created_at;`;//adding row in users

        const userResult = await client.query(userQuery,[username,email,password_hash]);

        const newUser = userResult.rows[0];

        const profileQuery = `
        INSERT INTO user_profiles (user_id, full_name)
        VALUES ($1, $2);
        `;
        await client.query(profileQuery,[newUser.user_id,full_name]);
        //commit transaction if both succeeded
        await client.query('COMMIT');

        return res.status(201).json({message:'User registered successfully',user: newUser,});
    } catch(err){
        await client.query('ROLLBACK');

        if (err.code ==='23505'){//postgres inbuilt code for unique constraint violation
            return res.status(409).json({error:'Username or email already exists'});
        }

        return res.status(500).json({error:'Internal server error during registration'});
    } finally{
        client.release();// always return that runner to the pool
    }
};