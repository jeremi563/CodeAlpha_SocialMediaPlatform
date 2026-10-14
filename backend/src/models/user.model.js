import mongoose from 'mongoose';
import { baseSchemaOptions } from './schemaOptions.js';
import { LIMITS,USERNAME_REGEX } from '../config/constants.js';

const userSchema = new mongoose.Schema({
    fullName:{
        type:String,
        required:[true,"Full name is required"],
        trim:true,
        maxlength:[LIMITS.FULL_NAME_MAX,`Full name cannot exceed ${LIMITS.FULL_NAME_MAX} characters`]
    },
    username:{
        type:String,
        required:[true,"Username is required"],
        unique:true,
        trim:true,
        lowercase:true,
        minlength:[LIMITS.USERNAME_MIN,`Username must be at least ${LIMITS.USERNAME_MIN} characters`],
        maxlength:[LIMITS.USERNAME_MAX,`Username cannot exceed ${LIMITS.USERNAME_MAX} characters`],
        match:[USERNAME_REGEX,"Username can only contain letters, numbers, and underscores"]
    },
    email:{
        type:String,
        required:[true,"Email is required"],
        unique:true,
        trim:true,
        lowercase:true,
        match:[/^\S+@\S+\.\S+$/,"Please provide a valid email address"]
    },
    passwordHash: {
        type: String,
        required: [true, "Password hash is required"],
        select: false, // Exclude passwordHash from query results by default
    },
    bio: {
        type: String,
        default: "",
        trim:true,
        maxlength:[LIMITS.BIO_MAX,`Bio cannot exceed ${LIMITS.BIO_MAX} characters`]
    },
    profilePictureId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        required: true,
    },
},baseSchemaOptions);

userSchema.set('toJSON',{
    ...baseSchemaOptions.toJSON,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (ret.profilePictureId) {
            ret.avatarUrl = `/api/users/${encodeURIComponent(ret.username)}/avatar/${ret.profilePictureId}`;
        }
        delete ret._id;
        delete ret.passwordHash;
        delete ret.profilePictureId;
        return ret;
    }
})

export const User = mongoose.model('User', userSchema);