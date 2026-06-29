---
name: wayland-zig
description: Writing Wayland compositors and protocol handlers in Zig. Use when implementing wl_compositor, wl_surface, wl_region, DRM/KMS backends, Wayland protocol code generation from XML, or compositor state machines in Zig. Triggers on: wayland compositor, wlroots, wl_surface, libwayland, wayland-scanner, wl_compositor, DRM KMS backend, or wayland protocol XML.
---

# Wayland Compositor Development in Zig

## Why this skill

Wayland compositor development has a steep learning curve: protocol wire format, resource lifetimes, surface state machines, and DRM/KMS buffer management. Writing one in Zig adds the complexity of C ABI interop through `@cImport`. This skill covers the patterns that work.

## Foundation: Wayland protocol codegen

Wayland protocol is defined in XML files. The C reference uses `wayland-scanner` to generate C headers and source. In Zig, you have two options:

### Option A: Use pre-generated C headers (simpler)

Generate C headers with wayland-scanner, then use `@cImport` in Zig:

```bash
wayland-scanner client-header /usr/share/wayland/wayland.xml wayland-client-protocol.h
wayland-scanner server-header /usr/share/wayland/wayland.xml wayland-server-protocol.h
```

```zig
const c = @cImport({
    @cInclude("wayland-server-protocol.h");
    @cInclude("wayland-client-protocol.h");
});
```

### Option B: Direct XML → Zig codegen

Parse the XML and generate Zig types directly. This avoids C interop for protocol types but requires implementing the wire format marshalling. Used in both Carnival (theme-park) and hyprland-zig.

Key protocol XML elements to handle:

- `<interface name="…" version="…">` → Zig struct with vtable
- `<request name="…">` → function pointer in the implementation vtable
- `<event name="…">` → function pointer in the listener/dispatcher
- `<arg name="…" type="…">` → parameter types (int, uint, string, object, new_id, fd, array)
- `<enum name="…">` → Zig enum type
- `<description>` → doc comments

## Resource and listener binding

The core compositor pattern: bind an implementation struct to a Wayland resource, then dispatch incoming messages.

```zig
// Typical compositor resource struct
const Surface = struct {
    resource: *c.wl_resource,
    compositor: *Compositor,
    // Surface state
    role: ?SurfaceRole,
    buffer: ?*c.wl_buffer,
    damage: std.ArrayList(c.wl_surface_damage),
    // Callbacks
    commit_listener: c.wl_listener,
    destroy_listener: c.wl_listener,
};

// Implementation vtable — is an array of function pointers matching
// the protocol XML order. Each interface has its own vtable.
const wl_surface_implementation = c.wl_surface_interface{
    .destroy = surface_destroy,
    .attach = surface_attach,
    .damage = surface_damage,
    .frame = surface_frame,
    .set_opaque_region = surface_set_opaque_region,
    .set_input_region = surface_set_input_region,
    .commit = surface_commit,
    .set_buffer_transform = surface_set_buffer_transform,
    .set_buffer_scale = surface_set_buffer_scale,
    .damage_buffer = surface_damage_buffer,
    .offset = surface_offset,
};

// Resource creation binds a wl_resource to its implementation
fn compositor_create_surface(client: *c.wl_client, resource: *c.wl_resource, id: u32) callconv(.C) void {
    const surface = // allocate and init Surface
    surface.resource = c.wl_resource_create(client, &c.wl_surface_interface, 4, id);
    c.wl_resource_set_implementation(
        surface.resource,
        &wl_surface_implementation,
        surface,
        surface_destroy_resource,
    );
}
```

## Surface state machine

The wl_surface protocol requires careful state tracking. Key states:

```
Idle → (attach buffer) → Pending commit → (commit called)
  → Committed → (frame callback fires) → Idle
```

**Double-buffered state**: Every surface has "pending" and "current" state. Changes go to pending; `commit` promotes pending to current.

```zig
// Surface state structure (simplified)
const SurfaceState = struct {
    buffer: ?*c.wl_buffer,
    dx: i32,
    dy: i32,
    damage: std.ArrayList(Rect),
    buffer_scale: i32,
    buffer_transform: c.wl_output_transform,
    opaque_region: ?Region,
    input_region: ?Region,
};

const Surface = struct {
    pending: SurfaceState,
    current: SurfaceState,
    // ...
};

fn surface_commit(client: *c.wl_client, resource: *c.wl_resource) callconv(.C) void {
    const surface = getSurface(resource);
    surface.current = surface.pending; // Promote pending → current
    // Apply damage, schedule repaint
    compositor_schedule_repaint(surface.compositor);
}
```

## Subsurface and role management

A surface gets a "role" when used by another protocol (xdg_shell, layer_shell, subcompositor). A surface can have only one role.

```zig
const SurfaceRole = union(enum) {
    none,
    xdg_surface,
    layer_surface,
    subsurface,
    cursor,
};
```

Enforce single-role before assigning:

```zig
fn surface_assign_role(surface: *Surface, role: SurfaceRole) !void {
    if (surface.role != .none) {
        c.wl_resource_post_error(surface.resource, error_role, "surface already has a role");
        return error.RoleAlreadyAssigned;
    }
    surface.role = role;
}
```

## DRM/KMS backend

Direct Rendering Manager / Kernel Mode Setting for display output. Key concepts:

- **DRM connector** — physical display output (HDMI, DP, eDP)
- **CRTC** — display controller (scanout engine)
- **Plane** — hardware layer (primary, cursor, overlay)
- **Framebuffer** — GPU buffer ready for scanout

### Opening the DRM device

```zig
const c = @cImport({
    @cInclude("xf86drm.h");
    @cInclude("xf86drmMode.h");
});

const drm_fd = c.drmOpen("card0", null);
// For render node (headless/test):
const drm_fd = c.drmOpenRender(128); // minor number

// Check DRM capabilities
var caps: u64 = 0;
_ = c.drmGetCap(drm_fd, c.DRM_CAP_DUMB_BUFFER, &caps);
```

### Enumerating connectors and modes

```zig
var resources = c.drmModeGetResources(drm_fd);
defer c.drmModeFreeResources(resources);

for (0..@intCast(resources.*.count_connectors)) |i| {
    const conn_id = resources.*.connectors[i];
    var conn = c.drmModeGetConnector(drm_fd, conn_id);
    defer c.drmModeFreeConnector(conn);

    if (conn.*.connection == c.DRMModeConnected and conn.*.count_modes > 0) {
        // Use the first (highest resolution) mode
        const mode = conn.*.modes[0];
        // Store for CRTC configuration
    }
}
```

### Setting a mode (KMS commit)

```zig
// Find a suitable CRTC and encoder
var encoder = c.drmModeGetEncoder(drm_fd, connector.*.encoder_id);
defer c.drmModeFreeEncoder(encoder);

// Allocate framebuffers (via GBM or dumb buffers)
// …

// Set the mode
_ = c.drmModeSetCrtc(
    drm_fd,
    crtc_id,
    fb_id,
    0, 0,           // x, y
    &connector_id,
    1,              // connector count
    &mode,
);
```

### GBM buffers (Graphics Buffer Manager)

```zig
const c = @cImport({
    @cInclude("gbm.h");
});

var gbm_device = c.gbm_create_device(drm_fd);
defer c.gbm_device_destroy(gbm_device);

var bo = c.gbm_bo_create(
    gbm_device,
    width, height,
    c.GBM_FORMAT_XRGB8888,
    c.GBM_BO_USE_SCANOUT | c.GBM_BO_USE_RENDERING,
);
defer c.gbm_bo_destroy(bo);

// Get the DRM framebuffer from the GBM buffer
const fb_id = gbm_bo_get_fb(bo);
```

### Page flipping (vsync-aware display)

```zig
fn page_flip_handler(fd: c_int, sequence: c_uint, tv_sec: c_uint, tv_usec: c_uint, data: ?*anyopaque) callconv(.C) void {
    const output = @as(*Output, @ptrCast(@alignCast(data)));
    output.page_flip_pending = false;
    // Schedule next frame
}

_ = c.drmModePageFlip(drm_fd, crtc_id, fb_id, c.DRM_MODE_PAGE_FLIP_EVENT, output);
```

## Common pitfalls

1. **Resource lifetime**: `wl_resource_destroy` is called by libwayland when the client disconnects. Your destroy handler (`surface_destroy_resource`) must free all Zig-allocated memory. Don't double-free — libwayland handles the resource itself.

2. **Thread safety**: Wayland protocol handlers run on the compositor's main event loop. Use `wl_event_loop_add_fd` for external events (DRM page flips, input device reads). Don't call Wayland functions from other threads.

3. **Protocol versioning**: Clients and servers negotiate protocol version at bind time. Check `wl_resource_get_version` before using versioned features.

4. **File descriptor lifetimes**: Wayland messages can carry fds (for shm buffers, dmabuf). Close them if you're not using them — they leak otherwise.

5. **wl_array**: Wayland's dynamic array type. Must be initialized with `wl_array_init` and freed with `wl_array_release`. Don't use Zig allocators directly on wl_array.

6. **send vs post**: `wl_resource_post_event` sends events to the client that owns the resource. `wl_resource_post_error` sends a protocol error and disconnects the client. Use `post_error` for protocol violations.

## Nix dev shell for Wayland compositor development

```nix
devShells.default = pkgs.mkShell {
  buildInputs = with pkgs; [
    zig
    pkg-config
    wayland wayland-protocols
    mesa           # GBM, EGL, GLES
    libdrm
    libinput libxkbcommon
    pixman
    fcft            # optional font rendering
    hwdata          # pnp.ids, etc.
  ];

  shellHook = ''
    export C_INCLUDE_PATH="${pkgs.wayland.dev}/include:${pkgs.wayland-protocols}/include:${pkgs.mesa}/include:${pkgs.libdrm.dev}/include:${pkgs.libinput.dev}/include:${pkgs.libxkbcommon.dev}/include:$C_INCLUDE_PATH"
  '';
};
```

## Related skills

- `skill://nix-zig-dev` — Nix flake setup for Zig with C deps (fuller treatment)
- `skill://zig-cinterop` — @cImport, translate-c, C ABI patterns
- `skill://zig-migration` — Zig version upgrade patterns
