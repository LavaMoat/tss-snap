# TSS Snap Dapp

This project is sadly using two bundlers; it was designed to use [parcel][] but creating a release build with [parcel][] yields an error - see [this bug report](https://github.com/parcel-bundler/parcel/issues/8680).

So we use [webpack][] to create a release build to workaround the parcel bug.

When the parcel bug is fixed we can remove the webpack build.

## Environment

You will need a `.env` and `.env.production` files. For the development `.env` just copy the `.env.example` file and complete the private fields.

For `.env.production` you should also set:

```
SNAP_ID=npm:@lavamoat/tss-snap
```

[parcel]: https://github.com/parcel-bundler/parcel
[webpack]: https://webpack.js.org/
