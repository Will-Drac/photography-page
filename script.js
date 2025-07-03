let device, adapter

async function loadWGSL(url) {
    const resp = await fetch(url)
    return await resp.text()
}

async function loadImageBitmap(url) {
    const res = await fetch(url)
    const blob = await res.blob()
    return await createImageBitmap(blob, { colorSpaceConversion: "none" })
}

const normalBlur = 10

let urlUsed = ""; let lastUrl = "wdajodi"; let shouldUpdateBackground = false
async function switchImages(url) {
    urlUsed = url

    const source = await loadImageBitmap(url)
    const texture = device.createTexture({
        label: url,
        format: "rgba8unorm",
        size: [source.width, source.height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    })

    device.queue.copyExternalImageToTexture(
        { source, flipY: true },
        { texture },
        { width: source.width, height: source.height }
    )

    textureToRender = texture


    // the picture needs to be blurred before it's used for normals
    const blurredTexture = device.createTexture({
        label: `${url} blurred`,
        format: "rgba16float",
        size: [source.width, source.height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING
    })
    const blurredTextureTEMP = device.createTexture({
        label: `${url} blurred temporary`,
        format: "rgba16float",
        size: [source.width, source.height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING
    })

    const blurModuleH = device.createShaderModule({
        code: (await loadWGSL("shaders/gaussianBlur.wgsl")) //configure the code to comment out the vertical part
            .replace("_STARTIFH", "")
            .replace("_ENDIFH", "")
            .replace("_STARTIFV", "/*")
            .replace("_ENDIFV", "*/")
            .replaceAll("R", normalBlur)
    })

    const blurPipelineH = device.createComputePipeline({
        layout: "auto",
        compute: { module: blurModuleH }
    })

    const blurBindGroupH = device.createBindGroup({
        layout: blurPipelineH.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: textureToRender.createView() },
            { binding: 1, resource: blurredTextureTEMP.createView() }
        ]
    })

    const blurEncoderH = device.createCommandEncoder()
    const blurHPass = blurEncoderH.beginComputePass()
    blurHPass.setPipeline(blurPipelineH)
    blurHPass.setBindGroup(0, blurBindGroupH)
    blurHPass.dispatchWorkgroups(textureToRender.width, textureToRender.height, 1)
    blurHPass.end()

    device.queue.submit([blurEncoderH.finish()])

    const blurModuleV = device.createShaderModule({
        code: (await loadWGSL("shaders/gaussianBlur.wgsl")) //configure the code to comment out the horizontal part
            .replace("_STARTIFH", "/*")
            .replace("_ENDIFH", "*/")
            .replace("_STARTIFV", "")
            .replace("_ENDIFV", "")
            .replaceAll("R", normalBlur)
    })

    const blurPipelineV = device.createComputePipeline({
        layout: "auto",
        compute: { module: blurModuleV }
    })

    const blurBindGroupV = device.createBindGroup({
        layout: blurPipelineV.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: blurredTextureTEMP.createView() },
            { binding: 1, resource: blurredTexture.createView() }
        ]
    })

    const blurEncoderV = device.createCommandEncoder()
    const blurVPass = blurEncoderV.beginComputePass()
    blurVPass.setPipeline(blurPipelineV)
    blurVPass.setBindGroup(0, blurBindGroupV)
    blurVPass.dispatchWorkgroups(textureToRender.width, textureToRender.height, 1)
    blurVPass.end()

    device.queue.submit([blurEncoderV.finish()])



    normalTexture = device.createTexture({
        label: `${url} normal texture`,
        format: "rgba16float",
        size: [source.width, source.height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    })

    const normalModule = device.createShaderModule({
        label: "normal module",
        code: await loadWGSL("shaders/normals.wgsl")
    })

    const normalPipeline = device.createComputePipeline({
        label: "normal pipeline",
        layout: "auto",
        compute: { module: normalModule }
    })

    const normalBindGroup = device.createBindGroup({
        layout: normalPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: blurredTexture.createView() },
            { binding: 1, resource: normalTexture.createView() }
        ]
    })

    const normalEncoder = device.createCommandEncoder()
    const normalPass = normalEncoder.beginComputePass()
    normalPass.setPipeline(normalPipeline)
    normalPass.setBindGroup(0, normalBindGroup)
    normalPass.dispatchWorkgroups(textureToRender.width, textureToRender.height, 1)
    normalPass.end()

    device.queue.submit([normalEncoder.finish()])

    if (lastUrl !== urlUsed) {
        lastUrl = urlUsed
        shouldUpdateBackground = true
    }

    // updating the info for the image
    await fetch(url)
        .then(res => res.blob())
        .then(blob => {
            const img = new Image()
            const url = URL.createObjectURL(blob)
            img.onload = function () {
                EXIF.getData(img, function () {
                    const data = EXIF.getAllTags(this)
                    console.log(data)

                    const dateAndTime = data.DateTimeOriginal.split(" ")
                    const date = dateAndTime[0].split(":")
                    const time = dateAndTime[1].split(":")

                    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

                    document.getElementById("dateAndTime").innerText = `${months[parseInt(date[1]) - 1]} ${parseInt(date[2])}, ${parseInt(date[0])}; ${time[0] % 12 == 0 ? 12 : time[0] % 12}:${time[1]} ${time[0] < 12 ? "AM" : "PM"}`

                    document.getElementById("exposure").innerText = `ISO ${data.ISOSpeedRatings}; f/${data.FNumber}; 1/${1/data.ExposureTime} sec.`

                    document.getElementById("zoom").innerText = `${data.FocalLengthIn35mmFilm} mm`
                })
            }
            img.src = url
        })

}

let textureToRender, normalTexture, backgroundTexture

async function main() {
    adapter = await navigator.gpu?.requestAdapter()
    device = await adapter?.requestDevice()

    if (!device) {
        alert("It seems like this browser doesn't support WebGPU")
        return
    }

    const canvas = document.getElementById("display")
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const context = canvas.getContext("webgpu")
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
    context.configure({
        device,
        format: presentationFormat
    })

    const mousePosBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    const mousePosValues = new Float32Array(2)

    const canvasSizeBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    const canvasSizeValues = new Float32Array(2)
    canvasSizeValues.set([canvas.width, canvas.height], 0)
    device.queue.writeBuffer(canvasSizeBuffer, 0, canvasSizeValues)

    await switchImages("pictures/P1050149.JPG")


    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear"
    })


    const cropModule = device.createShaderModule({
        code: await loadWGSL("shaders/crop.wgsl")
    })

    const cropPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: cropModule
        },
        fragment: {
            module: cropModule,
            targets: [{ format: presentationFormat }]
        }
    })

    const cropPassDescriptor = {
        colorAttachments: [{
            // view: <- to be filled out when we render
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store"
        }]
    }


    const lensModule = device.createShaderModule({
        code: await loadWGSL("shaders/lensBlur.wgsl")
    })

    const lensPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: lensModule
        },
        fragment: {
            module: lensModule,
            targets: [{ format: presentationFormat }]
        }
    })

    const lensPassDescriptor = {
        colorAttachments: [{
            // view: <- to be filled out when we render
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store"
        }]
    }


    const renderModule = device.createShaderModule({
        label: "render module",
        code: await loadWGSL("shaders/render.wgsl")
    })

    const renderPipeline = device.createRenderPipeline({
        label: "render pipeline",
        layout: "auto",
        vertex: {
            module: renderModule
        },
        fragment: {
            module: renderModule,
            targets: [{ format: presentationFormat }]
        }
    })

    const renderPassDescriptor = {
        colorAttachments: [{
            // view: <- to be filled out when we render
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store"
        }]
    }


    async function updateBackground() {
        const backgroundWidth = canvas.width / 2; const backgroundHeight = canvas.height / 2

        backgroundTexture = device.createTexture({
            format: presentationFormat,
            size: [backgroundWidth, backgroundHeight],
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        })


        // first crop the picture to be the background
        const croppedTexture = device.createTexture({
            format: presentationFormat,
            size: [backgroundWidth, backgroundHeight],
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        })

        cropPassDescriptor.colorAttachments[0].view = croppedTexture.createView()

        const cropBindGroup = device.createBindGroup({
            layout: cropPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: textureToRender.createView() },
                { binding: 2, resource: { buffer: canvasSizeBuffer } }
            ]
        })

        const cropEncoder = device.createCommandEncoder()
        const cropPass = cropEncoder.beginRenderPass(cropPassDescriptor)
        cropPass.setPipeline(cropPipeline)
        cropPass.setBindGroup(0, cropBindGroup)
        cropPass.draw(6)
        cropPass.end()

        device.queue.submit([cropEncoder.finish()])


        // then blur it
        lensPassDescriptor.colorAttachments[0].view = backgroundTexture.createView()

        const lensBindGroup = device.createBindGroup({
            layout: lensPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: croppedTexture.createView() }
            ]
        })

        const lensEncoder = device.createCommandEncoder()
        const lensPass = lensEncoder.beginRenderPass(lensPassDescriptor)
        lensPass.setPipeline(lensPipeline)
        lensPass.setBindGroup(0, lensBindGroup)
        lensPass.draw(6)
        lensPass.end()

        device.queue.submit([lensEncoder.finish()])
    }
    updateBackground()

    let lastCanvasWidth = 0; let lastCanvasHeight = 0; let lastUrl = ""
    async function render(time) {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight
        if (lastCanvasWidth !== canvas.width || lastCanvasHeight !== canvas.height) {
            lastCanvasWidth = canvas.width; lastCanvasHeight = canvas.height
            await updateBackground()
        }

        if (shouldUpdateBackground) {
            shouldUpdateBackground = false
            await updateBackground()
        }

        mousePosValues.set([mousePos[0] / canvas.width, mousePos[1] / canvas.height], 0)
        device.queue.writeBuffer(mousePosBuffer, 0, mousePosValues)

        canvasSizeValues.set([canvas.width, canvas.height], 0)
        device.queue.writeBuffer(canvasSizeBuffer, 0, canvasSizeValues)


        renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView()

        const renderBindGroup = device.createBindGroup({
            layout: renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: textureToRender.createView() }, //this might change between frames
                { binding: 2, resource: normalTexture.createView() }, //this might change between frames
                { binding: 3, resource: backgroundTexture.createView() },
                { binding: 4, resource: { buffer: mousePosBuffer } },
                { binding: 5, resource: { buffer: canvasSizeBuffer } }
            ]
        })

        const renderEncoder = device.createCommandEncoder()
        const renderPass = renderEncoder.beginRenderPass(renderPassDescriptor)
        renderPass.setPipeline(renderPipeline)
        renderPass.setBindGroup(0, renderBindGroup)
        renderPass.draw(6)
        renderPass.end()

        device.queue.submit([renderEncoder.finish()])

        requestAnimationFrame(render)
    }

    requestAnimationFrame(render)
}

let mousePos = []
document.getElementById("display").addEventListener("mousemove", function (e) {
    const canvas = document.getElementById("display")
    const rect = canvas.getBoundingClientRect()
    mousePos = [
        (e.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        (e.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    ]
})

document.getElementById("display").addEventListener("touchMove", function (e) {
    console.log("hi")
    const canvas = document.getElementById("display")
    const rect = canvas.getBoundingClientRect()
    mousePos = [
        (e.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        (e.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    ]
})


main()
