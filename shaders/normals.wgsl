@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(1)fn calculateNormals(
    @builtin(global_invocation_id) id: vec3u
) {
    let bottom = length(textureLoad(colorTexture, id.xy - vec2u(0, 2), 0).xyz);
    let left = length(textureLoad(colorTexture, id.xy - vec2u(2, 0), 0).xyz);
    let top = length(textureLoad(colorTexture, id.xy + vec2u(0, 2), 0).xyz);
    let right = length(textureLoad(colorTexture, id.xy + vec2u(2, 0), 0).xyz);

    // let normal = normalize(vec3f(right - left, top - bottom, 0.1));
    let normal = normalize(vec3f(left - right, bottom - top, 0.1));

    textureStore(normalTexture, id.xy, vec4f(normal.x, normal.y, normal.z, 1));
}