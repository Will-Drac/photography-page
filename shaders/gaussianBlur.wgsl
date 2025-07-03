@group(0) @binding(0) var originalTexture: texture_2d<f32>;
@group(0) @binding(1) var blurredTexture: texture_storage_2d<rgba16float, write>;

fn powInt(x: f32, y: u32) -> f32 {
    var z = 1.;
    for (var i = u32(0); i < y; i++) {
        z *= x;
    }
    return z;
}

fn sampleWeights(x: i32, r: i32) -> f32 {
    return 0.9375 * (powInt(f32(x) / f32(r + 1), 4) - 2. * powInt(f32(x) / f32(r + 1), 2) + 1.) / f32(r + 1);
}

@compute @workgroup_size(1)fn blur(
    @builtin(global_invocation_id) id: vec3u
) {
    var avgColor = vec4f(0.);

    let p = vec2i(id.xy);

    // horizontal pass
    _STARTIFH
    for (var i = -R; i <= R; i++) {
        avgColor += sampleWeights(i, R) * textureLoad(originalTexture, p+vec2i(i, 0), 0);
    }
    _ENDIFH

    // vertical pass
    _STARTIFV
    for (var i = -R; i <= R; i++) {
        avgColor += sampleWeights(i, R) * textureLoad(originalTexture, p+vec2i(0, i), 0);
    }
    _ENDIFV

    textureStore(blurredTexture, p,  avgColor);
}