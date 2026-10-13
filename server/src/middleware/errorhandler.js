export function notfound(req,res,next){
    res.status(404).json({error:'Route not found'});
}

export function errorhandler(err,req,res,next){
    if (err.code==='23505'){
        return res.status(409).json({error:'already exists(duplicate value)'
        });
    }
    if (err.code==='23514'){//CHECK constraint failed
        return res.status(400).json({error:'constraint violation(check rule)'
        });
    }
    if (err.code==='23503'){//foreign key points at something that doesnt exist
        return res.status(400).json({error:'referenced record does not exist'})
    }
    if (err.code==='entity.parse.failed'){
        return res.status(400).json({error:'malformed JSON body'}); //express's json reader shows if client sends broken json
    }
    return res.status(500).json({error:'internal server error'})
}
