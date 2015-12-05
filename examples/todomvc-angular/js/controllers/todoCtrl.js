
/*global todomvc, angular, DeltaDB */
'use strict';

/**
 * The main controller for the app. The controller:
 * - retrieves and persists the model via DeltaDB
 * - exposes the model to the template and provides event handlers
 */
todomvc.controller('TodoCtrl', function TodoCtrl($scope, $location, $timeout) {
	var db = new DeltaDB('todosdb', 'http://localhost:8080');

	var todos = db.col('todos');

	$scope.todos = [];
	$scope.newTodo = '';
	$scope.editedTodo = null;

	var pushTodo = function (todo) {
		$scope.todos.push(todo.get());
		$scope.$apply(); // update UI
	};

	todos.on('doc:create', function (todo) {
		// Doc was created so add to array
		pushTodo(todo);
	});

	var findIndex = function (id) {
		var index = null;
		$scope.todos.forEach(function (todo, i) {
			if (todo.$id === id) {
				index = i;
			}
		});
		return index;
	};

	var destroyTodo = function (todo) {
		var index = findIndex(todo.$id);
		if (index !== null) { // found?
			$scope.todos.splice(index, 1);
		}
	};

	todos.on('doc:update', function (todo) {
		var index = findIndex(todo.id());
		if (index !== null) { // found?
			$scope.todos[index] = todo.get();
			$scope.$apply(); // update UI
		}
	});

	todos.on('doc:destroy', function (todo) {
		destroyTodo({ $id: todo.id() });
		$scope.$apply();
	});

	$scope.$watch('todos', function () {
		var total = 0;
		var remaining = 0;

		$scope.todos.forEach(function (todo) {
			// Skip invalid entries so they don't break the entire app.
			if (!todo || !todo.title) {
				return;
			}

			total++;
			if (todo.completed === false) {
				remaining++;
			}
		});

		$scope.totalCount = total;
		$scope.remainingCount = remaining;
		$scope.completedCount = total - remaining;
		$scope.allChecked = remaining === 0;
	}, true);

	$scope.addTodo = function () {
		var newTodo = $scope.newTodo.trim();
		if (!newTodo.length) {
			return;
		}

		var todo = todos.doc({
			title: newTodo,
			completed: false
		});

		todo.save();

		$scope.newTodo = '';
	};

	$scope.editTodo = function (todo) {
		$scope.editedTodo = todo;
		$scope.originalTodo = angular.extend({}, $scope.editedTodo);
	};

	$scope.save = function (todo) {
		todos.get(todo.$id).then(function (todoDoc) {
			return todoDoc.set(todo);
		});
	};

	$scope.doneEditing = function (todo) {
		$scope.editedTodo = null;
		var title = todo.title.trim();
		if (title) {
			$scope.save(todo);
		} else {
			$scope.removeTodo(todo);
		}
	};

	$scope.revertEditing = function (todo) {
		todo.title = $scope.originalTodo.title;
		$scope.doneEditing(todo);
	};

	$scope.removeTodo = function (todo) {
		destroyTodo(todo);
		todos.get(todo.$id).then(function (todoDoc) {
			return todoDoc.destroy();
		});
	};

	$scope.clearCompletedTodos = function () {
		// Loop in reverse order, instead of using .forEach() as each time we remove an array element via
		// splice() we shift the indexes and this can lead to problems.
		var len = $scope.todos.length;
		for (var i = len - 1; i >= 0; i--) {
			if ($scope.todos[i].completed) {
				$scope.removeTodo($scope.todos[i]);
			}
		}
	};

	$scope.markAll = function (allCompleted) {
		$scope.todos.forEach(function (todo) {
			todo.completed = allCompleted;
			$scope.save(todo);
		});
	};

	if ($location.path() === '') {
		$location.path('/');
	}
	$scope.location = $location;
});
