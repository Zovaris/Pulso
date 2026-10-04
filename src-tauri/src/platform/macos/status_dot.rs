use objc2::rc::Retained;
use objc2::{AnyThread, MainThreadMarker};
use objc2_app_kit::{
    NSImage, NSImageView, NSStatusItem, NSUserInterfaceItemIdentification, NSView,
};
use objc2_foundation::{NSData, NSPoint, NSRect, NSSize, NSString};

const DOT: &[u8] = include_bytes!("../../../../assets/brand/pulso-attention.png");
const IDENTIFIER: &str = "pulso.attention";

/// In points. The dot covers the top right of the mark's ring, where a badge
/// sits on any other icon, and leaves the count beside it readable.
const SIZE: f64 = 7.0;
const FROM_LEFT: f64 = 11.0;
const FROM_TOP: f64 = 0.0;

/// Must run on the main thread; anywhere else it does nothing.
pub fn show(item: &NSStatusItem, visible: bool) {
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let Some(button) = item.button(mtm) else {
        return;
    };
    let existing = find(&button);
    if !visible {
        if let Some(view) = existing {
            view.removeFromSuperview();
        }
        return;
    }
    let view = match existing {
        Some(view) => view,
        None => {
            let Some(view) = make(mtm) else {
                return;
            };
            button.addSubview(&view);
            view
        }
    };
    view.setFrame(frame(&button, button.image().map(|image| image.size())));
}

fn find(button: &NSView) -> Option<Retained<NSView>> {
    let wanted = NSString::from_str(IDENTIFIER);
    button.subviews().iter().find(|view| {
        view.identifier()
            .is_some_and(|identifier| identifier.isEqualToString(&wanted))
    })
}

fn make(mtm: MainThreadMarker) -> Option<Retained<NSView>> {
    let image = NSImage::initWithData(NSImage::alloc(), &NSData::with_bytes(DOT))?;
    image.setSize(NSSize::new(SIZE, SIZE));
    let view = NSImageView::initWithFrame(
        mtm.alloc(),
        NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(SIZE, SIZE)),
    );
    view.setImage(Some(&image));
    view.setIdentifier(Some(&NSString::from_str(IDENTIFIER)));
    Some(Retained::into_super(Retained::into_super(view)))
}

/// The button centres its image, and the mark is the image's first 18 points.
fn frame(button: &NSView, image: Option<NSSize>) -> NSRect {
    let bounds = button.bounds();
    let image = image.unwrap_or(NSSize::new(18.0, 18.0));
    let left = (bounds.size.width - image.width) / 2.0 + FROM_LEFT;
    let top = (bounds.size.height - image.height) / 2.0 + FROM_TOP;
    let y = if button.isFlipped() {
        top
    } else {
        bounds.size.height - top - SIZE
    };
    NSRect::new(NSPoint::new(left, y), NSSize::new(SIZE, SIZE))
}
