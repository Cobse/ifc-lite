// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

//! `consolidate_coplanar`'s noise filter against real small openings (#4698).

use super::*;
use crate::kernel::arrangement::box_mesh;
use crate::kernel::mesh_bridge::{subtract, tris_to_mesh};

/// Summed area of the triangles whose unit normal is within 1e-3 of `n`.
fn area_facing(mesh: &Mesh, n: Vector3<f64>) -> f64 {
    let p = |i: u32| {
        let i = i as usize * 3;
        Vector3::new(
            mesh.positions[i] as f64,
            mesh.positions[i + 1] as f64,
            mesh.positions[i + 2] as f64,
        )
    };
    mesh.indices
        .chunks_exact(3)
        .map(|t| {
            let c = (p(t[1]) - p(t[0])).cross(&(p(t[2]) - p(t[0])));
            let len = c.norm();
            if len > 0.0 && (c / len - n).norm() < 1e-3 {
                0.5 * len
            } else {
                0.0
            }
        })
        .sum()
}

/// A 10 × 10 cm through-opening cut into a wall, then consolidated. The front
/// face must keep the opening's 0.01 m² out of its area on a small wall and on
/// a large one alike. The filter used to drop any hole under 1e-4 of the
/// plane's total area: 2e-4 m² on the 2 × 1 m wall, so the hole stayed, but
/// 0.02 m² on the 20 × 10 m wall, so the hole was filled and the front face
/// read the full 200 m². Mutation: make the plane share decide alone again and
/// the 20 m case fails.
#[test]
fn a_small_opening_keeps_its_hole_on_a_large_face_4698() {
    for (width, height) in [(2.0, 1.0), (20.0, 10.0)] {
        let wall = tris_to_mesh(&box_mesh([0.0, 0.0, 0.0], [width, 0.2, height]));
        let (cx, cz) = (width / 2.0, height / 2.0);
        let opening =
            tris_to_mesh(&box_mesh([cx - 0.05, -0.5, cz - 0.05], [cx + 0.05, 0.7, cz + 0.05]));
        let cut = ClippingProcessor::consolidate_coplanar(subtract(&wall, &opening));
        let front = area_facing(&cut, Vector3::new(0.0, -1.0, 0.0));
        let expected = width * height - 0.01;
        assert!(
            (front - expected).abs() < 1e-4,
            "{width} x {height} m wall: front face reads {front} m², expected {expected} m²"
        );
    }
}

/// Where the plane share still decides, and where it no longer does. Each case
/// is a ring the census or review met: a wide opening on a big face (kept, the
/// #4698 fix), a 50 µm rim sliver on the same face (still filled, as on main), a
/// 1.67 µm reveal lip that is its whole plane bucket (still kept, as on main:
/// ISSUE_159 #6012 re-tessellated from 1176 to 374 triangles when a pure width
/// rule dropped it), and a speck under the absolute floor. Mutations: the old
/// share-only rule fails the first case; a width-only rule at the snap step
/// (this PR's first revision) fails the second and third.
#[test]
fn ring_noise_needs_both_thin_and_a_small_share_of_the_plane_4698() {
    use nalgebra::Point2;
    let rect = |w: f64, h: f64| {
        vec![Point2::new(0.0, 0.0), Point2::new(w, 0.0), Point2::new(w, h), Point2::new(0.0, h)]
    };
    let facade = 200.0;
    assert!(!ring_is_noise(&rect(0.1, 0.1), facade), "a 10 cm opening on a 200 m² face is geometry");
    assert!(ring_is_noise(&rect(1.0, 50.0e-6), facade), "a 50 µm sliver on a 200 m² face is noise");
    let lip = rect(2.35, 1.67e-6);
    assert!(!ring_is_noise(&lip, 2.35 * 1.67e-6), "a reveal lip that is its whole plane is kept");
    assert!(ring_is_noise(&rect(5.0e-5, 5.0e-5), facade), "a 50 µm speck is under the area floor");
}
