# Generic Ember Plus

- [Ember Plus](https://github.com/Lawo/ember-plus)

This is a generic ember plus module - successful use of this tool requires use and familiary with Ember Plus Viewer or a similar tool to identify the Ember Paths, and types, to be monitored and controlled.

The module only supports connection via TCP.

## Configuration

### Bonjour

Some devices support mDNS announcements according to the Ember Plus [specification](https://github.com/Lawo/ember-plus/blob/master/documentation/Ember%2B%20Service%20Discovery.pdf). The module should discover these, otherwise device IP and Port can be manually entered.

### Matrix Control

If you require matrix control, enter the ember path(s) of the matrices here, separated by commas. The matrix actions and feedbacks choose from these. On connecting, the module loads each one: its targets, sources and connections, and its labels. A path that holds no element, or one that isn't a matrix, is left out, with a warning in the log, until the next connection or config change. See [Matrices](#matrices).

### Auto Take

Defines matrix behaviour.

### Paths to Monitor

Paths defined here will be registed with the host on initialisation, for use in actions and feedbacks. With **Parameter - Values** selected in Connection Variables they also get variables, and stream parameters among them with **Parameter - Streams**.

### Discover Elements Matching

Rather than typing every path, the module can walk the device's tree and find the parameters, functions and matrices whose paths match patterns given here, separated by commas. Empty, nothing is discovered.

- Each pattern is a path, its elements separated by `.` or `/`. An element is matched by its identifier, where `*` stands for any text (`Channel*`), or by its number. `*` alone is any one element; `**` is any number of elements, none included.
- A pattern starting with `!` excludes, whatever the order: `Mixer.**, !Mixer.*.Meters.**` finds everything below Mixer but its meters. An exclude ending in `**` also keeps the walk out of what it covers.
- Matching is exact, element by element, and case-sensitive: `1.1.**` doesn't take in `1.10`, and `In*` doesn't match `Main`.

What is found:

- **Parameters** are listed in the actions' and feedbacks' path dropdowns, and get presets. With **Parameter - Values** selected in Connection Variables they also get variables, kept up to date; without it, a parameter is only listed until an action or feedback uses it. A stream parameter, such as a meter, is listed but never subscribed to by discovery: only while a feedback reads it, as for any stream.
- **Functions** are listed in Invoke Function's dropdown. Discovery never invokes one.
- **Matrices** are listed in the log, with their paths, to add to Paths to matrices if wanted. They aren't loaded.

The walk runs on connecting and after the config is saved, breadth-first, and only into the parts of the tree the patterns lead to. Each node walked is a request to the device, which then reports changes below it for as long as the connection lasts, so keep the patterns narrow on a large device. **Discovery Node Limit** and **Discovery Parameter Limit**, 2048 each by default, stop the walk with a warning in the log and the connection status. A summary is logged after each walk.

### Connection Variables

What the connection makes variables for:

- **Parameter - Values**: a variable for each parameter in use, whether configured above or used by an action or feedback, holding its value (an enumeration also gets an `_ENUM` variable holding its entry). Selected by default. Without it no parameter variables are made: the **Parameter Property** feedback gives a parameter's value to a button's local variable instead. This replaces the actions' **Auto Create Variable** option of earlier versions.
- **Parameter - Streams**: the same for stream parameters, such as audio meters, whose values the device sends many times a second. Off by default: a meter's values are only streamed while something uses them, and with this on every meter in use streams for its variable.
- **Matrix - Target Names** and **Matrix - Source Names**: a variable for each target or source of each configured matrix, holding its name (see [Matrices](#matrices)), eg `matrix_1.4_target_1001_name`.
- **Matrix - Connections**: a variable for each target of each configured matrix, holding the sources connected to it, eg `matrix_1.4_target_1001_sources`: for an N:N matrix their numbers, as an array (empty for none); for any other, where a target takes one source, its number, or nothing for none.
- **Matrix - Target Disposition**: a variable for each target of each configured matrix, holding its connection's disposition as the device last reported it, eg `matrix_1.4_target_1001_disposition`: `tally` (the connection as it stands), `modified` (just changed), `pending` (a change queued, to be made later) or `locked` (the target refuses changes). A connection reported without one is a tally. Nothing until the matrix's connections have loaded, or for a target the device hasn't reported a connection for. The Matrix Property feedback's Connection Disposition gives the same.

Whatever is chosen here, each matrix found on the device has variables of its own: `matrix_<path>_name`, its description, or else its path by identifiers; `matrix_<path>_targets` and `matrix_<path>_sources`, the numbers of all its targets and sources, as arrays; and `matrix_<path>_type`, its type: `oneToN`, `oneToOne` or `nToN`. An N:N matrix also has `matrix_<path>_max_connects_per_target` and `matrix_<path>_max_total_connects`, its connection limits: as the device gives them, or else its source count, and its target count times its source count, as the specification has it.

### Apply Formula and Factor to Parameter Variables

On, the variables of number parameters hold the value as it is displayed: by the parameter's formula, or else divided by its factor (a meter's formula, for instance, giving dB). Off, they hold the device's value.

### Streams

A stream parameter, such as an audio meter, is one the device sends values for many times a second, and only to a consumer that subscribed to it. The module subscribes while a feedback reads the parameter, or while it has a variable (Parameter - Streams), and unsubscribes once neither is so; an action doesn't keep a stream, as it reads the value when it runs. Feedbacks are rechecked, and variables set, at most every 10 ms. Stream values aren't recorded by the Action Recorder.

### Ramp Step Interval

How often a Ramp Value action sends a step, in milliseconds, from 20 to 1000; 50 by default. Shorter is smoother, but sends more messages, and some devices may fall behind, giving a fade that is late or uneven. See Ramps below.

### Verbose Logs

Logs the Ember+ library's debug output, under the source `ember plus`, the full contents of each parameter as it is registered, and each value as it arrives. The module's own debug messages are always logged; Companion's log view shows them when its Debug level is selected.

## Paths

Central to the concept of ember+ is the address or path of the data element you wish to monitor or change. There are several ways to represent these in the module. Principally as decimals and strings. Regardless of the preferred method, one should be consistent - undesired behaviour can occur if the same path is specified in both methods across different actions and feedbacks.

- ### Decimal: 1.2.3.4

  Paths can always be entered as a decimal address (ie _1.2.3.4_). Forward slashes, as used in Ember+ Viewer, will be automatically substituted.

- ### String: Path.To.Ember.Node

  Paths can also be entered as a period seperated string. Such as _Path.To.Ember.Node_. These text paths can be found in Ember Plus Viewer, however they need to be reformatted to use period seperators rather than forward slashes. Note: ' ' & '#' characters used in ember paths are not supported for use in variables by companion, and will be replaced by '\_' in variable ids - the path can still be used in actions and feedbacks however.

- ### Decimal in Brackets: My Useful Ember Path [1.2.3.4]

  Any path field that contains brackets [] will just use the contents enclosed in the brackets as the path, if it is a valid decimal path. Thus you can copy paste any path with text and decimals from Ember Plus Viewer, and keep the text for readability or enter your own description _This is a very useful path[1.2.3.4]_. Only the path will be used for variable creation. This method cannot be used in config fields.

- ### Variables and Expressions

  Except in the module configuration, all of the above can be built from variables. The path dropdown of each action and feedback lists the registered paths, and also takes a path typed in. To build a path from variables, switch the field to expression mode and use `parseVariables`, eg `parseVariables("Gain[1.2.$(internal:custom_channel)]")`. Matrices are the exception: they are chosen from those in the module config.

## Value Fields

For Set Value Actions one must ensure the correct data type is selected. In particular confusion can occur between Integer and ENUM types.

Set Value Integer and Set Value Real take the value as it is displayed. The parameter's formula converts it to the device's value; an integer without one is multiplied by its factor, and rounded to a whole number. A factor counts only if it is a positive whole number, here and wherever the module applies one. A relative change is made to the displayed value. The Minimum and Maximum of a relative change are the device's values, not as displayed. This replaces Set Value Integer's Factor option of earlier versions; Learn fills in the displayed value.

Tick **Device Units** to give the value in the device's units instead: it is sent as it is, bypassing the parameter's formula and factor, and a relative change is added to the device's value. An Integer's value is rounded to a whole number; a Real's is sent with its fraction. With Device Units ticked, Learn fills in the device's value. For a parameter whose formula can't be computed, Learn fills in the device's value and ticks Device Units.

On upgrading, Set Value Integer's Factor option of earlier versions is removed, and every such action takes the displayed value from then on, converted by the parameter's own formula or factor. An action whose Factor matched the parameter's factor sends what it did; any other, check, particularly on parameters with a formula, and use Learn to fill in the displayed value, or tick Device Units to give the device's value.

Set Value ENUM finds an entry by name in the parameter's enumeration map, or else its enumeration, so a device whose entries aren't numbered from 0 is set correctly. An entry whose name begins with `~` is found with or without the `~`. A relative change steps through the entries in their order, passing over any outside the Minimum and Maximum.

Any value field can be switched to expression mode to set it from variables or an expression, eg `$(internal:custom_level) * 2`. This replaces the `Use Variable?` and `Path from String` options of earlier versions, which are converted automatically when the module is upgraded. An expression for a number field must give a number within the field's range, or the action is skipped. An expression for a checkbox is read as true or false, so for a variable holding text such as `on` or `off` use eg `!arrayIncludes(['', 'false', 'off', '0'], toLowerCase($(internal:custom_state)))`.

## Ramps

- **Ramp Value** fades an Integer or Real parameter to a value over a time. The value is as displayed, converted by the parameter's formula or factor, as for Set Value Integer and Set Value Real, and the ramp moves through the displayed values (dB, Hz), so a parameter with a formula fades evenly as displayed. With **Relative**, the value is an amount to change the displayed value by, within the Minimum and Maximum, which are the device's values, as for Set Value. **Learn** fills in the parameter's current displayed value.
- **Easing** sets how the value moves over the time: Linear, or Quadratic, Cubic, Quartic, Quintic, Sinusoidal, Exponential or Circular, each In (starting slowly), Out (ending slowly) or In/Out (both). Every curve moves steadily from start to target, never past it.
- A duration of one Ramp Step Interval or less sets the value at once.
- **Stop Ramp** stops the ramp on a parameter, or every ramp, where it has reached.

The module sends the steps itself, one every Ramp Step Interval, so a ramp works with any device. But it is a series of steps, not the device's own ramp: on audio, a parameter the device doesn't smooth may give audible steps, and an Integer with few values moves in visible jumps. A device's own ramp function, such as Lawo's `RampMotorFader`, can be called with Invoke Function instead.

A new ramp on a parameter stops the one running there, and starts from where it had reached; a relative ramp adds its change to that point. A Set Value on the parameter, a reconnection, and saving the module config also stop its ramp. A ramp doesn't notice the value changed another way, such as a fader moved by hand: its next step overwrites it.

In an action group that waits for each action, the next action waits for a ramp to finish when it takes less than about 5 seconds, so short ramps can be chained. Companion stops waiting for an action after 5 seconds, so a longer ramp finishes on its own after the action has completed: add a delay before the next action if it must wait. Aborting the running actions stops a ramp the group is waiting for.

## Functions

Ember+ devices may expose executable functions (such as triggering snapshots, firing macros, or executing remote methods).

- **Invoke Function**: Invokes an Ember+ `Function` node on the target device. Arguments can be passed comma-separated (e.g. `123, "text", true`), line-separated, or as a JSON array (e.g. `[123, "text", true]`). Dynamic Companion variables are supported.

## Matrices

The matrix actions and feedbacks choose a matrix from those in the module config, listed by path and, once loaded, by its path's identifiers, eg `1.4: Audio.Matrix`. They are only offered while there is a matrix: none are without matrices in the config, or once the device has shown none of those configured to be one. The chosen matrix's targets and sources are then chosen from dropdowns listing each by number and name, eg `1001: Studio A`. A signal's name is its first label: from the first of the matrix's label sets that has one, or else the first in its own labels node, as the device provides them. A signal without a label is named by its identifier, or else listed by number alone. The dropdowns list a matrix's signals once it is loaded from the device; until then, or for a number not listed, switch the field to expression mode and give the number.

Changes the device reports to a matrix's connections, its signals' identifiers and their labels are followed as they happen, updating the dropdowns and variables. Labels are also read again when the module reconnects or its config is saved, and when the device moves a matrix's labels (adds a label set, or gives a signal another labels node).

- **Matrix Connect**, **Matrix Disconnect** and **Matrix Set Connection** connect sources to a target, disconnect them from it, or connect exactly those sources, replacing the target's others. For an N:N matrix several sources can be chosen; for any other matrix, one. Set Connection's source can be **None**, which disconnects the target's sources. The Ember+ specification has connect and disconnect requests for N:N matrices only, so on any other matrix Matrix Connect sets the target's source outright, as Set Connection does (the first source, where an expression gives several), and Matrix Disconnect clears it if the chosen source is the one connected; if another source is connected, nothing is sent. Until the matrix's connections have loaded from the device, Matrix Disconnect is sent as a disconnect request. The **Learn** button of Matrix Connect and Matrix Set Connection fills in the sources connected to the chosen target, once the matrix's connections have loaded. For a target with no source connected, Set Connection learns None (no sources, on an N:N matrix), and Matrix Connect changes nothing.
- **Set Selected Target**, **Set Selected Source**, **Take** and **Clear** make an XY selection on a matrix, connected by Take, or at once with Auto-Take, as Matrix Connect connects.

On upgrading, the matrix actions and feedbacks of earlier versions are converted. Those that chose a matrix by its number in the config list choose it by path. The path of a Matrix Connect, Disconnect or Set Connection action is added to the module config's matrices if it isn't there. One built from variables can't be: such an action fails until a matrix is chosen for it, and its target and sources set again.

## Actions

- Set Value Integer
- Set Value Real
- Set Value Boolean
- Set Value ENUM
- Set Value String
- Invoke Function
- Matrix Connect
- Matrix Disconnect
- Matrix Set Connection
- Take
- Clear
- Set Selected Source
- Set Selected Target
- Set Host
- Ramp Value
- Stop Ramp

## Host

The host and port the module is configured to connect to are exposed as the `host` and `port` variables. They can be changed at runtime with the **Set Host** action, which saves the new values to the module config and reconnects. As the action sets the host directly, it also clears any device selected via Bonjour.

The host accepts variables, and may be left empty to keep the currently configured host, so the action can change the port alone. The port is a number from 1 to 65535; switch it to expression mode to set it from a variable. The action will fail if the host is not a plausible hostname or IP. Set Host actions from earlier versions with an empty port take the port the connection had when the module was upgraded. Use the action's **Learn** button to reset both fields to the values the module is currently configured with.

## Feedbacks

- Parameter Property
- Matrix Property
- Parameter Compare Number (Deprecated)
- Parameter Equals String (Deprecated)
- Parameter ENUM Equals String (Deprecated)
- Parameter True (Deprecated)
- Take is possible
- Clear is possible
- Source Background If Selected
- Target Background if Selected

### Parameter Property

Returns a property of a parameter to a button's local variable, chosen from:

- **Value**: the value as the device reports it, with no formula or factor applied: the device's units, as Minimum, Maximum and Default Value are. Octet strings are returned as an array of bytes.
- **Value by Formula / Factor**: the value as a number, by the parameter's formula, or else divided by its factor: what Set Value Integer and Set Value Real take, and what the parameter variables hold with Apply Formula and Factor on. A parameter with neither returns its value as reported; an enumeration, its number.
- **Value with Units**: the value by its formula or factor, formatted by the parameter's format, with its unit, eg `-12.5 dB`.
- **Minimum by Formula / Factor**, **Maximum by Formula / Factor** and **Step by Formula / Factor**: the same for its range, lower end first, and its step. An enumeration stating no range takes its entries'; an integer stating no step takes 1. A real without a step has none.
- **Identifier Path**: the parameter's path by the identifiers of it and the nodes above it, eg `Device.Inputs.Gain`.
- **Value as Enumeration Entry**: the name of the value's entry, from the parameter's enumeration map or enumeration. A parameter with neither returns its value as reported. This replaces the Return ENUM checkbox of earlier versions.
- The parameter's own properties, as the provider reports them: Identifier, Description, Type, Access, Minimum, Maximum, Default Value, Factor, Format, Step, Online, Stream Identifier, Stream Descriptor, Schema Identifiers and Template Reference. A property the provider doesn't report returns nothing.

A factor counts only if it is a positive whole number; a parameter reporting any other is taken to have none. The Factor property still returns it as reported.

On upgrading, feedbacks that returned Value (an integer divided by its factor, before 3.0) are moved to Value by Formula / Factor, so they keep the numbers they showed; for a parameter with a formula, they now return the formula's result. Value by Formula and Value as Displayed, of the 3.0 pre-releases, are both Value by Formula / Factor. A property chosen by an expression isn't changed: one giving `value` now gets the value as reported.

Use it in an expression to style a button, or compare the value, in place of the deprecated feedbacks.

### Matrix Property

Returns a property of a matrix's target or source to a button's local variable. Choose the matrix, Source or Target, which one, then the property:

- **Name**: its first label, or else its identifier, as for the dropdowns (see [Matrices](#matrices)).
- **Identifier**, **Online** and **Labels Location**, as the device reports them. Online is true unless the device says otherwise.
- A target's **Connected Sources**: for an N:N matrix the numbers of the sources connected to it, as an array; for any other, the source's number, or nothing for none.
- A target's **Connection Disposition**: the device's last report on its connection: `tally`, `modified`, `pending` (a change is queued) or `locked` (the target refused a change).

The feedback returns nothing for a matrix not yet loaded, or a signal it doesn't have.

### Deprecated feedbacks

Parameter Compare Number, Parameter Equals String, Parameter ENUM Equals String and Parameter True are deprecated, and will be removed in a future release. Use Parameter Property in an expression instead.

Parameter Compare Number, Parameter Equals String, and Parameter True type coerce all data to the respective data type, thus can be used on any node type. Ie, you can check a boolean node with the Parameter Equals String feedback by setting the Value to _true_. However, the path dropdown for each feedback is filtered to parameters of the appropriate type(s) for ease of use. Prior to version 2.5 all data was coerced to strings prior to equality tests. The path field of each feedback presents a dropdown of registered paths. New paths can be typed in, or built from variables in expression mode, and if valid will be automatically registered and added to the dropdowns and, with Parameter - Values selected, the variable list.

## Composite Elements

The module also provides graphics elements for your own layered buttons:

- `Signal Meter`: a bar for a level, such as an audio meter, along any edge of the button, coloured by the audio metering scale or in one colour.
- `Value Dial`, `Centred Dial` and `Width Dial`: knob-style arcs, filling from the minimum, growing out from zero, or opening out from the middle.

Give each one a value and the ends of its range, eg from Parameter Property feedbacks into local variables. A parameter's Minimum and Maximum properties are its device values, so they suit its Value; for Value by Formula / Factor, such as a meter's level in dB, use Minimum and Maximum by Formula / Factor, or give the ends as displayed, eg -60 and 0.

## Presets

The module offers presets for the parameters it has registered: those in Paths to Monitor, and any an action or feedback uses. Add a parameter's path to Paths to Monitor to get its preset. Each is grouped under its parent node, and shows the parameter's path by its identifiers, eg `Device.Inputs.Gain`. A parameter offline, or under a node offline, gets none.

- **Toggles**, for a boolean parameter with read-write access: a press toggles it. ON or OFF in the middle, green while on, and its path along the bottom.
- **Rotaries**, for an integer, real or enumeration parameter with read-write access: a turn steps it, and a turn while pressed takes a finer step. A dial shows where the value sits in its range, with the value in the middle (by formula or factor, with its units, or an enumeration's entry name) and the path along the bottom. A number needs a minimum and a maximum, or it gets no rotary; an enumeration stating none takes its entries as its range.
- **Meters**, for a stream parameter such as an audio meter: a meter along the bottom, its level by formula or factor, the path in the middle and the level with its units at the top. Its range is the parameter's, or -100 to 0 where the parameter gives none.
- **Take** and **Clear**, for XY matrix control.

Each kind of button is one template preset, made for each parameter by its path, which it reads its name, range and step by through Parameter Property. A button that stays linked to its preset lets these be changed, under Preset variables, as well as its `path`:

- `font_size_value` and `font_size_name`: the size of the value and of the path.
- On a rotary, `min` and `max`: the range a turn is held to, and the dial drawn across, as displayed. `auto` takes the parameter's own; set one to narrow it.
- On a number rotary, `step_size` and `step_size_fine`: the step a turn takes, and while pressed, as displayed. `auto` works it out from the parameter: a 50th of its range, in whole steps of its own, and its own step while pressed (a 500th of the range for a real without one, or with one no smaller than its range).
- On a number rotary, `logarithmic`: set it to `true` for a parameter read on a log scale, such as a frequency. A turn then multiplies the value, by a fraction of a doubling (`step_divisions`, 3 by default: a third of an octave; `step_divisions_fine`, 24, while pressed), and the dial is drawn on a log scale.
- On a meter, `meter_min` and `meter_max`: its range. `auto` takes the parameter's, or -100 to 0 where it gives none.

## Action Recorder

The Action Recorder can record Set Value actions for ember parameters you are currently subscribed to.

It also records a **Matrix Set Connection** action for each target of a configured matrix whose connection changes while recording, once the matrix's connections have loaded. Each target is recorded once, with its latest sources: a list on an N:N matrix, one source on any other, and none (**None**, or an empty list) for a target left with no source. Played back, each sets its target's connection to exactly what was recorded. Connections loading on connecting aren't recorded.
