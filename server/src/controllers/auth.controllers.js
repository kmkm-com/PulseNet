import bcrypt from 'bcrypt';
import pool from '../db/pool.js';
import jwt from 'jsonwebtoken';

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

export const login = async(req,res) => {
    const {email,password} = req.body;

    //validate input
    if (!email||!password){
        return res.status(400).json({error:'email and password are reqd'});
    }

    try{
        const query = `
        SELECT user_id, username, email, password_hash
        FROM users
        WHERE LOWER(email) = LOWER($1);
        `;

        const result = await pool.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'invalid email or password' });
        }

        const user = result.rows[0];

        // Optional status check if column exists in the future
        if (user.account_status && user.account_status !== 'active') {
            return res.status(403).json({ error: 'account is not active' });
        }

        //compare bcrypt passwords
        const ismatch = await bcrypt.compare(password, user.password_hash);
        if (!ismatch) {
            return res.status(401).json({ error: 'invalid email or password' });
        }

        //issue jwt token
        const token = jwt.sign(
            { user_id: user.user_id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            message: 'login successful',
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error during login' });
    }
};

export const me = async(req,res) => {
    const client = await pool.connect();

    try {
        const { user_id } = req.user; //after implementing auth middleware
        const query = `
        SELECT u.user_id, u.username, u.email, u.created_at,
               p.full_name,
               p.bio,
               p.profile_image_url
        FROM users u
        LEFT JOIN user_profiles p ON u.user_id = p.user_id
        WHERE u.user_id = $1;
        `;
        const result = await pool.query(query,[user_id]);

        if (result.rows.length===0){
            return res.status(404).json({error:'User not found'});
        }

        res.status(200).json({user:result.rows[0]});
    } catch (err) {
        console.error('Error fetching user profile:',err);
        res.status(500).json({error:'internal server error'});
    }
};