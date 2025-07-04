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
@group(0) @binding(2) var normalTexture: texture_2d<f32>;
@group(0) @binding(3) var croppedTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> mousePos: vec2f;
@group(0) @binding(5) var<uniform> canvasSize: vec2f;

fn rotateX(v: vec3f, theta: f32) -> vec3f {
    return vec3f(
        v.x,
        v.y * cos(theta) - v.z * sin(theta),
        v.y * sin(theta) + v.z * cos(theta),
    );
}

fn rotateY(v: vec3f, theta: f32) -> vec3f {
    return vec3f(
        v.x * cos(theta) + v.z * sin(theta),
        v.y,
        -v.x * sin(theta) + v.z * cos(theta)
    );
}

const lightDir = normalize(vec3f(3, -2, -1));

@fragment fn fs(fsInput: vertexShaderOutput) -> @location(0)vec4f {
    let pictureDimensions = vec2f(textureDimensions(colorTexture));
    let PAspect = pictureDimensions.x / pictureDimensions.y;
    let CAspect = canvasSize.x / canvasSize.y;

    let fovVertical = 0.3490; //90deg fov
    let fovHorizontal = 2 * atan(CAspect * tan(fovVertical / 2));

    const pictureDistance = 3;

    let screenUV = fsInput.texcoord;
    let atanh = atan(fovHorizontal / 2);
    let atanv = atan(fovVertical / 2);
    let viewRay = normalize(vec3f(
        screenUV.x * 2 * atanh - atanh,
        screenUV.y * 2 * atanv - atanv,
        1
    ));

    var pictureNormal = vec3f(0, 0, 1);
    pictureNormal = rotateX(pictureNormal, mousePos.y-0.5);
    pictureNormal = rotateY(pictureNormal, mousePos.x-0.5);

    let rayPlaneIntersectionT = dot(vec3f(0, 0, pictureDistance), pictureNormal) / dot(viewRay, pictureNormal);
    let rayPlaneIntersection = viewRay * rayPlaneIntersectionT;

    // at this point, by default, the picture will show square with a good margin guaranteed only at the top and bottom (if the uvs are rayPlaneIntersection.xy)

    var pictureUV = rayPlaneIntersection.xy;
    if (PAspect >= CAspect) { //the picture is more horizontal than the canvas
        pictureUV /= CAspect;
        pictureUV.y *= PAspect;
    }
    else { //the picture is more vertical than the canvas
        // the top and bottom margins are already good, but we have to scale the x direction to keep the aspect ratio of the picture
        pictureUV.x /= PAspect;
    }

    pictureUV += vec2f(0.5);


    var c = textureSample(colorTexture, textureSampler, pictureUV);
    var n = textureSample(normalTexture, textureSampler, pictureUV);

    let surfaceNorm = rotateY(rotateX(n.xyz, -mousePos.y+0.5), -mousePos.x+0.5);

    let reflectionVector = reflect(viewRay, surfaceNorm);
    let shine = max(0, pow(dot(reflectionVector, lightDir), 5));
    let ambient = 1.;
    let lightingAmount = shine + ambient;

    let bgCol = textureSample(croppedTexture, textureSampler, fsInput.texcoord);
    if (pictureUV.x > 1 || pictureUV.x < 0 || pictureUV.y > 1 || pictureUV.y < 0) {
        return bgCol;
    }

    return lightingAmount*c;
}