/**
 * Shared schema options and transforms used by all models.
 * Keeps _id → id mapping and sensitive-field stripping consistent.
 */

export const baseSchemaOptions = {
  timestamps: true,       // adds createdAt and updatedAt automatically
  versionKey: false,      // removes __v (we don't use it)
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  },
};