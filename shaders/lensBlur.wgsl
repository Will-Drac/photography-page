struct vertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f
};

@vertex fn vs(
    @builtin(vertex_index) vertexIndex: u32
) -> vertexShaderOutput {
    let pos = array( //two triangles making a quad that covers the whole screen
        vec2f(-1.0, -1.0),
        vec2f(1.0, -1.0),
        vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0),
        vec2f(1.0, -1.0),
        vec2f(1.0, 1.0));

    var output: vertexShaderOutput;
    let xy = pos[vertexIndex];
    output.position = vec4f(xy, 0.0, 1.0);
    output.texcoord = (xy + 1.) / 2.;

    return output;
}

const R = 10;

@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var croppedTexture: texture_2d<f32>;

fn highlight1(v: f32) -> f32 {
    if v <= 0.5 {
        return v;
    } else {
        return 4 * v * v-3 * v + 1;
    }
}

fn highlight(col: vec4f) -> vec4f {
    return vec4f(
        highlight1(col.r),
        highlight1(col.g),
        highlight1(col.b),
        col.a
    );
}

@fragment fn fs(fsInput: vertexShaderOutput) -> @location(0)vec4f {
    let p = vec2f(fsInput.texcoord.x, 1 - fsInput.texcoord.y);

    let D = vec2f(textureDimensions(croppedTexture));

    var avgColor = vec4f(0);

    for (var i = -R; i <= R; i++) {
        for (var j = -R; j <= R; j++) {
            if i * i + j * j <= R * R {
                avgColor += textureSample(croppedTexture, textureSampler, (p * D + vec2f(f32(i), f32(j))) / D);
            }
        }
    }

    avgColor /= 3.141592 * R * R;

    return highlight(avgColor);
}