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


@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var colorTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> canvasSize: vec2f;

@fragment fn fs(fsInput: vertexShaderOutput) -> @location(0)vec4f {
    let pictureDimensions = vec2f(textureDimensions(colorTexture));
    let PAspect = pictureDimensions.x / pictureDimensions.y;
    let CAspect = canvasSize.x / canvasSize.y;

    var pictureUV = vec2f(fsInput.texcoord.x, 1-fsInput.texcoord.y) - vec2f(0.5);
    if (PAspect >= CAspect) { //the picture is more horizontal than the canvas
        pictureUV.x /= PAspect / CAspect;
    }
    else { //the picture is more vertical than the canvas
        pictureUV.y *= PAspect/CAspect;
    }
    pictureUV += vec2f(0.5);


    var c = textureSample(colorTexture, textureSampler, pictureUV);

    return c;
}